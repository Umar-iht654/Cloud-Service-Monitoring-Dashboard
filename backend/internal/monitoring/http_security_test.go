package monitoring

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"net/url"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type fakeResolver struct {
	mu        sync.Mutex
	addresses map[string][]netip.Addr
	errors    map[string]error
	calls     []string
}

func (r *fakeResolver) LookupNetIP(_ context.Context, _ string, host string) ([]netip.Addr, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.calls = append(r.calls, host)
	if err := r.errors[host]; err != nil {
		return nil, err
	}

	return append([]netip.Addr(nil), r.addresses[host]...), nil
}

type recordingDialer struct {
	mu     sync.Mutex
	calls  []string
	dialFn dialContextFunc
}

func (d *recordingDialer) DialContext(ctx context.Context, network string, address string) (net.Conn, error) {
	d.mu.Lock()
	d.calls = append(d.calls, address)
	d.mu.Unlock()

	return d.dialFn(ctx, network, address)
}

func (d *recordingDialer) callCount() int {
	d.mu.Lock()
	defer d.mu.Unlock()
	return len(d.calls)
}

func TestValidateServiceURLAllowsPublicHTTPAndHTTPS(t *testing.T) {
	tests := []string{
		"http://status.example.com",
		"https://api.example.com:8443/v1/health?full=true",
		"http://8.8.8.8:8080/health",
		"https://[2606:4700:4700::1111]/dns-query",
	}

	for _, rawURL := range tests {
		t.Run(rawURL, func(t *testing.T) {
			if err := ValidateServiceURL(rawURL); err != nil {
				t.Fatalf("expected URL to be allowed, got %v", err)
			}
		})
	}
}

func TestValidateServiceURLRejectsUnsupportedOrMalformedURLs(t *testing.T) {
	tests := []string{
		"",
		"example.com",
		"http://",
		"http://[::1",
		"http://example.com:invalid",
		"http://example.com:0",
		"http://example.com:65536",
		"file:///etc/passwd",
		"ftp://example.com/file",
		"gopher://example.com",
		"unix:///var/run/socket",
		"data:text/plain,hello",
	}

	for _, rawURL := range tests {
		t.Run(rawURL, func(t *testing.T) {
			err := ValidateServiceURL(rawURL)
			if !errors.Is(err, ErrInvalidServiceURL) {
				t.Fatalf("expected ErrInvalidServiceURL, got %v", err)
			}
		})
	}
}

func TestValidateServiceURLRejectsNonPublicLiteralAddresses(t *testing.T) {
	tests := map[string]string{
		"IPv4 unspecified range":       "http://0.1.2.3",
		"IPv4 loopback":                "http://127.0.0.1",
		"IPv4 private 10/8":            "http://10.0.0.1",
		"IPv4 private 172.16/12":       "http://172.16.10.20",
		"IPv4 private 192.168/16":      "http://192.168.1.10",
		"IPv4 carrier-grade NAT":       "http://100.64.0.1",
		"IPv4 link-local metadata":     "http://169.254.169.254/latest/meta-data/",
		"IPv4 benchmarking":            "http://198.18.0.1",
		"IPv4 multicast":               "http://224.0.0.1",
		"IPv4 reserved":                "http://240.0.0.1",
		"IPv6 unspecified":             "http://[::]",
		"IPv6 loopback":                "http://[::1]",
		"IPv6 unique-local":            "http://[fc00::1]",
		"IPv6 link-local":              "http://[fe80::1]",
		"IPv6 multicast":               "http://[ff02::1]",
		"IPv4-mapped IPv6 loopback":    "http://[::ffff:127.0.0.1]",
		"IPv6 documentation":           "http://[2001:db8::1]",
		"localhost mixed case and dot": "http://LOCALHOST./health",
	}

	for name, rawURL := range tests {
		t.Run(name, func(t *testing.T) {
			err := ValidateServiceURL(rawURL)
			if !errors.Is(err, ErrBlockedDestination) {
				t.Fatalf("expected ErrBlockedDestination, got %v", err)
			}
		})
	}
}

func TestSecureDialerValidatesEveryResolvedAddressBeforeDialing(t *testing.T) {
	publicAddress := netip.MustParseAddr("93.184.216.34")
	tests := []struct {
		name       string
		host       string
		addresses  []netip.Addr
		wantErr    error
		wantDials  int
		wantTarget string
	}{
		{
			name:      "hostname to loopback",
			host:      "loopback.example",
			addresses: []netip.Addr{netip.MustParseAddr("127.0.0.1")},
			wantErr:   ErrBlockedDestination,
		},
		{
			name:      "hostname to private IPv4",
			host:      "private.example",
			addresses: []netip.Addr{netip.MustParseAddr("10.0.0.8")},
			wantErr:   ErrBlockedDestination,
		},
		{
			name:      "hostname to IPv6 unique-local",
			host:      "private-v6.example",
			addresses: []netip.Addr{netip.MustParseAddr("fd00::8")},
			wantErr:   ErrBlockedDestination,
		},
		{
			name:      "hostname to IPv4-mapped IPv6 loopback",
			host:      "mapped-loopback.example",
			addresses: []netip.Addr{netip.MustParseAddr("::ffff:127.0.0.1")},
			wantErr:   ErrBlockedDestination,
		},
		{
			name:      "mixed public IPv4 and private IPv6 results",
			host:      "mixed.example",
			addresses: []netip.Addr{publicAddress, netip.MustParseAddr("fd00::8")},
			wantErr:   ErrBlockedDestination,
		},
		{
			name:      "alternate-looking hostname resolved to loopback",
			host:      "127.1",
			addresses: []netip.Addr{netip.MustParseAddr("127.0.0.1")},
			wantErr:   ErrBlockedDestination,
		},
		{
			name:       "hostname to public address",
			host:       "public.example",
			addresses:  []netip.Addr{publicAddress},
			wantErr:    errSyntheticDial,
			wantDials:  1,
			wantTarget: "93.184.216.34:8443",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			resolver := &fakeResolver{addresses: map[string][]netip.Addr{test.host: test.addresses}}
			dialer := &recordingDialer{dialFn: func(context.Context, string, string) (net.Conn, error) {
				return nil, errSyntheticDial
			}}
			protectedDialer := &secureDialer{resolver: resolver, dialContext: dialer.DialContext}

			_, err := protectedDialer.DialContext(context.Background(), "tcp", net.JoinHostPort(test.host, "8443"))
			if !errors.Is(err, test.wantErr) {
				t.Fatalf("expected %v, got %v", test.wantErr, err)
			}

			if dialer.callCount() != test.wantDials {
				t.Fatalf("expected %d dial attempts, got %d", test.wantDials, dialer.callCount())
			}

			if test.wantTarget != "" && dialer.calls[0] != test.wantTarget {
				t.Fatalf("expected pinned target %q, got %q", test.wantTarget, dialer.calls[0])
			}
		})
	}
}

func TestSecureDialerFallsBackAcrossPublicResults(t *testing.T) {
	resolver := &fakeResolver{addresses: map[string][]netip.Addr{
		"multi.example": {
			netip.MustParseAddr("93.184.216.34"),
			netip.MustParseAddr("93.184.216.35"),
		},
	}}
	dialer := &recordingDialer{dialFn: func(_ context.Context, _ string, address string) (net.Conn, error) {
		if address == "93.184.216.34:443" {
			return nil, errors.New("synthetic first-address failure")
		}

		client, server := net.Pipe()
		server.Close()
		return client, nil
	}}
	protectedDialer := &secureDialer{resolver: resolver, dialContext: dialer.DialContext}

	connection, err := protectedDialer.DialContext(context.Background(), "tcp", "multi.example:443")
	if err != nil {
		t.Fatalf("expected second public address to succeed, got %v", err)
	}
	connection.Close()
	if dialer.callCount() != 2 {
		t.Fatalf("expected two public dial attempts, got %d", dialer.callCount())
	}
}

func TestSecureDialerDoesNotLetOnePublicAddressConsumeTheWholeDeadline(t *testing.T) {
	resolver := &fakeResolver{addresses: map[string][]netip.Addr{
		"multi.example": {
			netip.MustParseAddr("93.184.216.34"),
			netip.MustParseAddr("93.184.216.35"),
		},
	}}
	dialer := &recordingDialer{dialFn: func(ctx context.Context, _ string, address string) (net.Conn, error) {
		if address == "93.184.216.34:443" {
			<-ctx.Done()
			return nil, ctx.Err()
		}

		client, server := net.Pipe()
		server.Close()
		return client, nil
	}}
	protectedDialer := &secureDialer{resolver: resolver, dialContext: dialer.DialContext}
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	connection, err := protectedDialer.DialContext(ctx, "tcp", "multi.example:443")
	if err != nil {
		t.Fatalf("expected fallback within the overall deadline, got %v", err)
	}
	connection.Close()
	if dialer.callCount() != 2 {
		t.Fatalf("expected two public dial attempts, got %d", dialer.callCount())
	}
}

func TestSecureDialerFailsClosedWhenResolutionFails(t *testing.T) {
	resolver := &fakeResolver{
		addresses: map[string][]netip.Addr{},
		errors:    map[string]error{"missing.example": errors.New("synthetic resolver failure")},
	}
	dialer := &recordingDialer{dialFn: func(context.Context, string, string) (net.Conn, error) {
		return nil, errSyntheticDial
	}}
	protectedDialer := &secureDialer{resolver: resolver, dialContext: dialer.DialContext}

	_, err := protectedDialer.DialContext(context.Background(), "tcp", "missing.example:80")
	if !errors.Is(err, ErrDestinationResolution) {
		t.Fatalf("expected ErrDestinationResolution, got %v", err)
	}
	if dialer.callCount() != 0 {
		t.Fatalf("expected no dial attempts, got %d", dialer.callCount())
	}
}

func TestSecureClientFollowsRedirectsBetweenAllowedDestinations(t *testing.T) {
	var destinationHits atomic.Int32
	destination := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		destinationHits.Add(1)
		if request.Host != "destination.example" {
			t.Errorf("expected destination Host header, got %q", request.Host)
		}
		response.WriteHeader(http.StatusNoContent)
	}))
	defer destination.Close()

	origin := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		http.Redirect(response, request, "http://destination.example/final", http.StatusFound)
	}))
	defer origin.Close()

	resolver := &fakeResolver{addresses: map[string][]netip.Addr{
		"origin.example":      {netip.MustParseAddr("93.184.216.34")},
		"destination.example": {netip.MustParseAddr("93.184.216.35")},
	}}
	dialer := newLocalRoutingDialer(t, map[string]string{
		"93.184.216.34:80": listenerAddress(t, origin.URL),
		"93.184.216.35:80": listenerAddress(t, destination.URL),
	})
	client := newSecureHTTPClient(time.Second, resolver, dialer.DialContext)
	defer client.CloseIdleConnections()

	response, err := client.Get("http://origin.example/start")
	if err != nil {
		t.Fatalf("expected allowed redirect to succeed, got %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusNoContent {
		t.Fatalf("expected status %d, got %d", http.StatusNoContent, response.StatusCode)
	}
	if destinationHits.Load() != 1 {
		t.Fatalf("expected allowed destination to be reached once, got %d", destinationHits.Load())
	}
}

func TestSecureClientRejectsRedirectToBlockedDestinationBeforeDial(t *testing.T) {
	var blockedHits atomic.Int32
	blocked := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		blockedHits.Add(1)
		response.WriteHeader(http.StatusOK)
	}))
	defer blocked.Close()

	origin := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		http.Redirect(response, request, blocked.URL+"/secret", http.StatusFound)
	}))
	defer origin.Close()

	resolver := &fakeResolver{addresses: map[string][]netip.Addr{
		"origin.example": {netip.MustParseAddr("93.184.216.34")},
	}}
	dialer := newLocalRoutingDialer(t, map[string]string{
		"93.184.216.34:80": listenerAddress(t, origin.URL),
	})
	client := newSecureHTTPClient(time.Second, resolver, dialer.DialContext)
	defer client.CloseIdleConnections()

	response, err := client.Get("http://origin.example/start")
	if response != nil {
		response.Body.Close()
	}
	if !errors.Is(err, ErrBlockedDestination) {
		t.Fatalf("expected blocked redirect error, got %v", err)
	}
	if blockedHits.Load() != 0 {
		t.Fatalf("expected blocked server not to be reached, got %d requests", blockedHits.Load())
	}
	if dialer.callCount() != 1 {
		t.Fatalf("expected only the allowed origin to be dialed, got %d dials", dialer.callCount())
	}
}

func TestSecureClientRejectsRedirectToHostnameResolvingPrivate(t *testing.T) {
	origin := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		http.Redirect(response, request, "http://private.example/secret", http.StatusFound)
	}))
	defer origin.Close()

	resolver := &fakeResolver{addresses: map[string][]netip.Addr{
		"origin.example":  {netip.MustParseAddr("93.184.216.34")},
		"private.example": {netip.MustParseAddr("10.0.0.8")},
	}}
	dialer := newLocalRoutingDialer(t, map[string]string{
		"93.184.216.34:80": listenerAddress(t, origin.URL),
	})
	client := newSecureHTTPClient(time.Second, resolver, dialer.DialContext)
	defer client.CloseIdleConnections()

	response, err := client.Get("http://origin.example/start")
	if response != nil {
		response.Body.Close()
	}
	if !errors.Is(err, ErrBlockedDestination) {
		t.Fatalf("expected blocked redirect error, got %v", err)
	}
	if dialer.callCount() != 1 {
		t.Fatalf("expected private redirect not to reach lower dialer, got %d dials", dialer.callCount())
	}
}

func TestSecureClientPreservesTimeout(t *testing.T) {
	slow := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		<-request.Context().Done()
	}))
	defer slow.Close()

	resolver := &fakeResolver{addresses: map[string][]netip.Addr{
		"slow.example": {netip.MustParseAddr("93.184.216.34")},
	}}
	dialer := newLocalRoutingDialer(t, map[string]string{
		"93.184.216.34:80": listenerAddress(t, slow.URL),
	})
	client := newSecureHTTPClient(50*time.Millisecond, resolver, dialer.DialContext)
	defer client.CloseIdleConnections()

	startedAt := time.Now()
	response, err := client.Get("http://slow.example/wait")
	if response != nil {
		response.Body.Close()
	}
	if err == nil {
		t.Fatal("expected request timeout")
	}
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected deadline exceeded, got %v", err)
	}
	if elapsed := time.Since(startedAt); elapsed > time.Second {
		t.Fatalf("expected timeout near configured duration, took %s", elapsed)
	}
}

func TestSecureClientPreservesHTTPSHostnameAndSNI(t *testing.T) {
	type requestIdentity struct {
		host       string
		serverName string
	}
	identity := make(chan requestIdentity, 1)

	server := httptest.NewTLSServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		identity <- requestIdentity{host: request.Host, serverName: request.TLS.ServerName}
		response.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	resolver := &fakeResolver{addresses: map[string][]netip.Addr{
		"secure.example": {netip.MustParseAddr("93.184.216.34")},
	}}
	dialer := newLocalRoutingDialer(t, map[string]string{
		"93.184.216.34:443": listenerAddress(t, server.URL),
	})
	client := newSecureHTTPClient(time.Second, resolver, dialer.DialContext)
	defer client.CloseIdleConnections()

	// The test server uses a synthetic certificate; verification is disabled only
	// in this test so the server can report the SNI chosen by the transport.
	client.Transport.(*validatingTransport).transport.TLSClientConfig = &tls.Config{ //nolint:gosec
		InsecureSkipVerify: true,
	}

	response, err := client.Get("https://secure.example/health")
	if err != nil {
		t.Fatalf("expected HTTPS request to succeed, got %v", err)
	}
	response.Body.Close()

	request := <-identity
	if request.host != "secure.example" {
		t.Fatalf("expected Host header %q, got %q", "secure.example", request.host)
	}
	if request.serverName != "secure.example" {
		t.Fatalf("expected TLS SNI %q, got %q", "secure.example", request.serverName)
	}
}

var errSyntheticDial = errors.New("synthetic dial reached")

func newLocalRoutingDialer(t *testing.T, routes map[string]string) *recordingDialer {
	t.Helper()

	localDialer := &net.Dialer{}
	return &recordingDialer{dialFn: func(ctx context.Context, network string, address string) (net.Conn, error) {
		localAddress, ok := routes[address]
		if !ok {
			return nil, fmt.Errorf("unexpected synthetic destination %s", address)
		}
		return localDialer.DialContext(ctx, network, localAddress)
	}}
}

func listenerAddress(t *testing.T, rawURL string) string {
	t.Helper()

	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("failed to parse test server URL: %v", err)
	}
	return parsedURL.Host
}
