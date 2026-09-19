package worker

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Umar-iht654/Cloud-DevOps-Monitoring-Dashboard/backend/internal/models"
	"github.com/Umar-iht654/Cloud-DevOps-Monitoring-Dashboard/backend/internal/monitoring"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestHealthCheckerClassificationRemainsUnchangedForAllowedDestinations(t *testing.T) {
	tests := []struct {
		name          string
		responseCode  int
		responseDelay time.Duration
		slowThreshold int
		wantStatus    string
	}{
		{
			name:          "online",
			responseCode:  http.StatusOK,
			slowThreshold: 1000,
			wantStatus:    "online",
		},
		{
			name:          "slow",
			responseCode:  http.StatusOK,
			responseDelay: 20 * time.Millisecond,
			slowThreshold: 1,
			wantStatus:    "slow",
		},
		{
			name:          "down",
			responseCode:  http.StatusServiceUnavailable,
			slowThreshold: 1000,
			wantStatus:    "down",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			db := newHealthCheckerTestDB(t)
			service := createHealthCheckerTestService(t, db, "https://public.example/health", test.slowThreshold)

			client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
				if request.URL.Host != "public.example" {
					t.Fatalf("unexpected request host %q", request.URL.Host)
				}
				time.Sleep(test.responseDelay)
				return &http.Response{
					StatusCode: test.responseCode,
					Header:     make(http.Header),
					Body:       io.NopCloser(strings.NewReader("")),
					Request:    request,
				}, nil
			})}
			checker := &HealthChecker{DB: db, Client: client}

			checker.checkService(service)

			var check models.HealthCheck
			if err := db.Where("service_id = ?", service.ID).First(&check).Error; err != nil {
				t.Fatalf("failed to load saved health check: %v", err)
			}
			if check.Status != test.wantStatus {
				t.Fatalf("expected status %q, got %q", test.wantStatus, check.Status)
			}
			if check.HTTPStatusCode == nil || *check.HTTPStatusCode != test.responseCode {
				t.Fatalf("expected HTTP status %d, got %v", test.responseCode, check.HTTPStatusCode)
			}

			var updatedService models.Service
			if err := db.First(&updatedService, service.ID).Error; err != nil {
				t.Fatalf("failed to load updated service: %v", err)
			}
			if updatedService.CurrentStatus != test.wantStatus {
				t.Fatalf("expected current status %q, got %q", test.wantStatus, updatedService.CurrentStatus)
			}
		})
	}
}

func TestHealthCheckerBlocksExistingUnsafeServiceWithoutRequestingIt(t *testing.T) {
	var hits int
	blocked := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		hits++
		response.WriteHeader(http.StatusOK)
	}))
	defer blocked.Close()

	db := newHealthCheckerTestDB(t)
	service := createHealthCheckerTestService(t, db, blocked.URL, 1000)
	checker := NewHealthChecker(db, nil)

	checker.checkService(service)

	if hits != 0 {
		t.Fatalf("expected blocked loopback server not to be requested, got %d requests", hits)
	}

	var check models.HealthCheck
	if err := db.Where("service_id = ?", service.ID).First(&check).Error; err != nil {
		t.Fatalf("failed to load saved health check: %v", err)
	}
	if check.Status != "down" {
		t.Fatalf("expected blocked service to be down, got %q", check.Status)
	}
	if check.ErrorMessage != monitoring.ErrBlockedDestination.Error() {
		t.Fatalf("expected safe blocked-destination message, got %q", check.ErrorMessage)
	}
	if check.HTTPStatusCode != nil {
		t.Fatalf("expected no HTTP status for blocked request, got %d", *check.HTTPStatusCode)
	}
}

func TestHealthCheckErrorMessageDoesNotExposeResolverDetails(t *testing.T) {
	resolverDetail := errors.New("lookup failed via resolver at 10.0.0.53")
	wrapped := fmt.Errorf("request failed: %w: %v", monitoring.ErrDestinationResolution, resolverDetail)

	message := healthCheckErrorMessage(wrapped)
	if message != monitoring.ErrDestinationResolution.Error() {
		t.Fatalf("expected safe resolution message, got %q", message)
	}
	if strings.Contains(message, "10.0.0.53") {
		t.Fatalf("resolver details leaked in %q", message)
	}
}

func newHealthCheckerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	if err := db.AutoMigrate(&models.User{}, &models.Service{}, &models.HealthCheck{}, &models.Alert{}); err != nil {
		t.Fatalf("failed to migrate test database: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("failed to access test database: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() {
		if err := sqlDB.Close(); err != nil {
			t.Errorf("failed to close test database: %v", err)
		}
	})

	return db
}

func createHealthCheckerTestService(t *testing.T, db *gorm.DB, rawURL string, slowThreshold int) models.Service {
	t.Helper()

	user := models.User{
		Name:         "Test User",
		Email:        fmt.Sprintf("%s@example.com", strings.ReplaceAll(t.Name(), "/", "-")),
		PasswordHash: "test-password-hash",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	service := models.Service{
		UserID:               user.ID,
		Name:                 "Test Service",
		URL:                  rawURL,
		ExpectedStatusCode:   http.StatusOK,
		SlowThresholdMs:      slowThreshold,
		CheckIntervalSeconds: monitoring.DefaultCheckIntervalSeconds,
		// Suppress alert/email creation in classification tests; this field is
		// intentionally overwritten by the health-check result under test.
		CurrentStatus: "down",
	}
	if err := db.Create(&service).Error; err != nil {
		t.Fatalf("failed to create test service: %v", err)
	}

	return service
}
