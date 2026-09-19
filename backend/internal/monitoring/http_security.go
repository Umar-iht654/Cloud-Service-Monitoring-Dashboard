package monitoring

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var (
	// ErrInvalidServiceURL is safe to return through the API or store with a failed check.
	ErrInvalidServiceURL = errors.New("service URL must be a valid http or https URL")

	// ErrBlockedDestination deliberately omits the rejected hostname and address.
	ErrBlockedDestination = errors.New("service URL must point to a public network destination")

	// ErrDestinationResolution avoids exposing details about the server's resolver.
	ErrDestinationResolution = errors.New("service hostname could not be resolved")
)

var (
	publicIPv6Prefix = netip.MustParsePrefix("2000::/3")

	nonPublicPrefixes = []netip.Prefix{
		// IPv4 special-purpose ranges that are not ordinary public destinations.
		netip.MustParsePrefix("0.0.0.0/8"),
		netip.MustParsePrefix("100.64.0.0/10"),
		netip.MustParsePrefix("192.0.0.0/24"),
		netip.MustParsePrefix("192.0.2.0/24"),
		netip.MustParsePrefix("192.88.99.0/24"),
		netip.MustParsePrefix("198.18.0.0/15"),
		netip.MustParsePrefix("198.51.100.0/24"),
		netip.MustParsePrefix("203.0.113.0/24"),
		netip.MustParsePrefix("240.0.0.0/4"),

		// IPv6 special-purpose ranges within the global-unicast allocation.
		netip.MustParsePrefix("2001::/23"),
		netip.MustParsePrefix("2001:db8::/32"),
		netip.MustParsePrefix("2002::/16"),
		netip.MustParsePrefix("3fff::/20"),
	}
)

// ipResolver is the narrow part of net.Resolver used by the protected dialer.
type ipResolver interface {
	LookupNetIP(ctx context.Context, network string, host string) ([]netip.Addr, error)
}

type dialContextFunc func(ctx context.Context, network string, address string) (net.Conn, error)

// secureDialer resolves a hostname once, validates the complete answer set, and
// then dials only the resulting numeric addresses. This prevents a second DNS
// lookup from creating a validation-versus-connection race.
type secureDialer struct {
	resolver    ipResolver
	dialContext dialContextFunc
}

// validatingTransport applies URL policy to the initial request and every
// redirect before the underlying transport can reuse or create a connection.
type validatingTransport struct {
	transport *http.Transport
}

// ValidateServiceURL validates URL structure, scheme, and any literal IP.
// Hostname resolution remains in the dial path so validation and connection
// cannot be separated by a DNS change.
func ValidateServiceURL(rawURL string) error {
	if rawURL == "" || strings.TrimSpace(rawURL) != rawURL {
		return ErrInvalidServiceURL
	}

	parsedURL, err := url.ParseRequestURI(rawURL)
	if err != nil || parsedURL.Opaque != "" {
		return ErrInvalidServiceURL
	}

	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return ErrInvalidServiceURL
	}

	hostname := parsedURL.Hostname()
	if parsedURL.Host == "" || hostname == "" {
		return ErrInvalidServiceURL
	}
	if port := parsedURL.Port(); port != "" {
		portNumber, err := strconv.Atoi(port)
		if err != nil || portNumber < 1 || portNumber > 65535 {
			return ErrInvalidServiceURL
		}
	}

	if isLocalhostName(hostname) {
		return ErrBlockedDestination
	}

	if address, err := netip.ParseAddr(hostname); err == nil && !isPublicDestination(address) {
		return ErrBlockedDestination
	}

	return nil
}

// NewSecureHTTPClient creates the client used by the monitoring worker.
func NewSecureHTTPClient(timeout time.Duration) *http.Client {
	dialer := &net.Dialer{
		Timeout:   timeout,
		KeepAlive: 30 * time.Second,
	}

	return newSecureHTTPClient(timeout, net.DefaultResolver, dialer.DialContext)
}

func newSecureHTTPClient(timeout time.Duration, resolver ipResolver, dialContext dialContextFunc) *http.Client {
	protectedDialer := &secureDialer{
		resolver:    resolver,
		dialContext: dialContext,
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	// A proxy could resolve and connect to the original hostname outside the
	// protected dial path, so monitoring requests always connect directly.
	transport.Proxy = nil
	transport.DialContext = protectedDialer.DialContext
	// Force HTTPS to establish TCP through the same protected dialer before the
	// transport performs its normal TLS handshake with the original hostname.
	transport.DialTLS = nil
	transport.DialTLSContext = nil

	return &http.Client{
		Transport: &validatingTransport{transport: transport},
		Timeout:   timeout,
	}
}

func (t *validatingTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	if err := ValidateServiceURL(request.URL.String()); err != nil {
		return nil, err
	}

	return t.transport.RoundTrip(request)
}

func (t *validatingTransport) CloseIdleConnections() {
	t.transport.CloseIdleConnections()
}

func (d *secureDialer) DialContext(ctx context.Context, network string, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil || host == "" || port == "" {
		return nil, ErrInvalidServiceURL
	}

	addresses, err := d.resolve(ctx, host)
	if err != nil {
		return nil, err
	}

	// Reject the complete answer before attempting any connection. A hostname
	// with both public and private answers is therefore blocked rather than
	// relying on address ordering.
	for _, candidate := range addresses {
		if !isPublicDestination(candidate) {
			return nil, ErrBlockedDestination
		}
	}

	var lastErr error
	for index, candidate := range addresses {
		destination := net.JoinHostPort(candidate.String(), port)
		attemptContext, cancelAttempt := dialAttemptContext(ctx, len(addresses)-index)
		connection, dialErr := d.dialContext(attemptContext, network, destination)
		cancelAttempt()
		if dialErr == nil {
			return connection, nil
		}
		if connection != nil {
			connection.Close()
		}

		lastErr = dialErr
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
	}

	return nil, lastErr
}

func dialAttemptContext(ctx context.Context, addressesRemaining int) (context.Context, context.CancelFunc) {
	if addressesRemaining <= 1 {
		return ctx, func() {}
	}

	deadline, hasDeadline := ctx.Deadline()
	if !hasDeadline {
		return ctx, func() {}
	}

	remaining := time.Until(deadline)
	attemptTimeout := remaining / time.Duration(addressesRemaining)
	const maxAttemptTimeout = 2 * time.Second
	if attemptTimeout > maxAttemptTimeout {
		attemptTimeout = maxAttemptTimeout
	}

	return context.WithTimeout(ctx, attemptTimeout)
}

func (d *secureDialer) resolve(ctx context.Context, host string) ([]netip.Addr, error) {
	if literal, err := netip.ParseAddr(host); err == nil {
		return []netip.Addr{literal}, nil
	}

	addresses, err := d.resolver.LookupNetIP(ctx, "ip", host)
	if err != nil || len(addresses) == 0 {
		return nil, ErrDestinationResolution
	}

	return addresses, nil
}

func isLocalhostName(hostname string) bool {
	normalized := strings.TrimSuffix(strings.ToLower(hostname), ".")
	return normalized == "localhost" || strings.HasSuffix(normalized, ".localhost")
}

func isPublicDestination(address netip.Addr) bool {
	if !address.IsValid() || address.Zone() != "" {
		return false
	}

	address = address.Unmap()
	if !address.IsGlobalUnicast() || address.IsPrivate() {
		return false
	}

	if address.Is6() && !publicIPv6Prefix.Contains(address) {
		return false
	}

	for _, prefix := range nonPublicPrefixes {
		if prefix.Contains(address) {
			return false
		}
	}

	return true
}
