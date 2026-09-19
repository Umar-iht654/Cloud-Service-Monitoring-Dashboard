package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Umar-iht654/Cloud-DevOps-Monitoring-Dashboard/backend/internal/models"
	"github.com/Umar-iht654/Cloud-DevOps-Monitoring-Dashboard/backend/internal/monitoring"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestCreateServiceRejectsBlockedLiteralURL(t *testing.T) {
	router, db := setupServiceHandlerTest(t)
	response := performServiceRequest(t, router, http.MethodPost, "/api/services", gin.H{
		"name": "Unsafe Service",
		"url":  "http://169.254.169.254/latest/meta-data/",
	})

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d: %s", http.StatusBadRequest, response.Code, response.Body.String())
	}
	if message := decodeServiceMessage(t, response); message != monitoring.ErrBlockedDestination.Error() {
		t.Fatalf("expected blocked-destination message, got %q", message)
	}

	var count int64
	if err := db.Model(&models.Service{}).Count(&count).Error; err != nil {
		t.Fatalf("failed to count services: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected blocked service not to be stored, got %d services", count)
	}
}

func TestCreateServiceStillAcceptsPublicStyleURL(t *testing.T) {
	router, db := setupServiceHandlerTest(t)
	response := performServiceRequest(t, router, http.MethodPost, "/api/services", gin.H{
		"name": "Public API",
		"url":  "https://api.example.com:8443/health",
	})

	if response.Code != http.StatusCreated {
		t.Fatalf("expected status %d, got %d: %s", http.StatusCreated, response.Code, response.Body.String())
	}

	var service models.Service
	if err := db.First(&service).Error; err != nil {
		t.Fatalf("failed to load created service: %v", err)
	}
	if service.URL != "https://api.example.com:8443/health" {
		t.Fatalf("expected public URL to be stored unchanged, got %q", service.URL)
	}
}

func TestUpdateServiceRejectsBlockedLiteralURL(t *testing.T) {
	router, db := setupServiceHandlerTest(t)
	service := models.Service{
		UserID:               1,
		Name:                 "Public Service",
		URL:                  "https://public.example/health",
		ExpectedStatusCode:   http.StatusOK,
		SlowThresholdMs:      750,
		CheckIntervalSeconds: monitoring.DefaultCheckIntervalSeconds,
		CurrentStatus:        "unknown",
	}
	if err := db.Create(&service).Error; err != nil {
		t.Fatalf("failed to create test service: %v", err)
	}

	response := performServiceRequest(t, router, http.MethodPut, fmt.Sprintf("/api/services/%d", service.ID), gin.H{
		"url": "http://[::1]:8080/private",
	})

	if response.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d: %s", http.StatusBadRequest, response.Code, response.Body.String())
	}
	if message := decodeServiceMessage(t, response); message != monitoring.ErrBlockedDestination.Error() {
		t.Fatalf("expected blocked-destination message, got %q", message)
	}

	var stored models.Service
	if err := db.First(&stored, service.ID).Error; err != nil {
		t.Fatalf("failed to reload service: %v", err)
	}
	if stored.URL != service.URL {
		t.Fatalf("expected URL to remain %q, got %q", service.URL, stored.URL)
	}
}

func setupServiceHandlerTest(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}
	if err := db.AutoMigrate(&models.Service{}); err != nil {
		t.Fatalf("failed to migrate test database: %v", err)
	}

	handler := NewServiceHandler(db)
	router := gin.New()
	router.Use(func(context *gin.Context) {
		context.Set("userID", uint(1))
		context.Next()
	})
	router.POST("/api/services", handler.CreateService)
	router.PUT("/api/services/:id", handler.UpdateService)

	return router, db
}

func performServiceRequest(t *testing.T, router *gin.Engine, method string, path string, payload gin.H) *httptest.ResponseRecorder {
	t.Helper()

	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal request: %v", err)
	}
	request := httptest.NewRequest(method, path, bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")

	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func decodeServiceMessage(t *testing.T, response *httptest.ResponseRecorder) string {
	t.Helper()

	var payload struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	return payload.Message
}
