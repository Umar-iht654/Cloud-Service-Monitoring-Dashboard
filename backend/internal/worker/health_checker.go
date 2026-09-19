package worker

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/Umar-iht654/Cloud-DevOps-Monitoring-Dashboard/backend/internal/email"
	"github.com/Umar-iht654/Cloud-DevOps-Monitoring-Dashboard/backend/internal/metrics"
	"github.com/Umar-iht654/Cloud-DevOps-Monitoring-Dashboard/backend/internal/models"
	"github.com/Umar-iht654/Cloud-DevOps-Monitoring-Dashboard/backend/internal/monitoring"
	"gorm.io/gorm"
)

// HealthChecker stores everything needed to run background service checks.
type HealthChecker struct {
	// DB gives the health checker access to PostgreSQL through GORM.
	DB *gorm.DB

	// Client is used to send HTTP requests to monitored service URLs.
	Client *http.Client

	// ScanInterval controls how often the worker scans the database for services that need checking.
	ScanInterval time.Duration

	// EmailSender sends downtime email notifications.
	EmailSender *email.Sender
}

// NewHealthChecker creates a new background health checker.
func NewHealthChecker(db *gorm.DB, emailSender *email.Sender) *HealthChecker {
	// This returns a HealthChecker with database access, an HTTP client and a scan interval.
	return &HealthChecker{
		// This stores the database connection inside the health checker.
		DB: db,

		// This creates an SSRF-protected HTTP client with the existing 10-second timeout.
		Client: monitoring.NewSecureHTTPClient(10 * time.Second),

		// This makes the worker scan for due services every 10 seconds.
		ScanInterval: 10 * time.Second,

		// This stores the email sender used for downtime notifications.
		EmailSender: emailSender,
	}
}

// Start begins the background health checking loop.
func (h *HealthChecker) Start() {
	// This logs that the background worker has started.
	log.Println("Background health checker started")

	// This gives the API server a short moment to fully start before checks begin.
	time.Sleep(2 * time.Second)

	// This runs one health check scan immediately after startup.
	h.runOnce()

	// This creates a ticker that triggers repeatedly based on the scan interval.
	ticker := time.NewTicker(h.ScanInterval)

	// This stops the ticker if the Start function ever exits.
	defer ticker.Stop()

	// This keeps the worker running forever while the backend is running.
	for range ticker.C {
		// This runs another scan each time the ticker triggers.
		h.runOnce()
	}
}

// runOnce scans all services and checks the ones that are due.
func (h *HealthChecker) runOnce() {
	// This creates a slice to store services loaded from the database.
	var services []models.Service

	// This fetches all monitored services from the database.
	if err := h.DB.Find(&services).Error; err != nil {
		// This logs the database error instead of crashing the backend.
		log.Println("Failed to fetch services for health check:", err)

		// This stops the current scan because services could not be loaded.
		return
	}

	// This loops through each monitored service.
	for _, service := range services {
		// This checks whether this service is due for another health check.
		shouldCheck := h.shouldCheckService(service)

		// This skips the service if it is not due yet.
		if !shouldCheck {
			// This moves to the next service in the loop.
			continue
		}

		// This checks the service URL and records the result.
		h.checkService(service)
	}
}

// shouldCheckService decides whether a service should be checked now.
func (h *HealthChecker) shouldCheckService(service models.Service) bool {
	// This creates a variable to store the latest health check for this service.
	var latestCheck models.HealthCheck

	// This gets the most recent health check for the service.
	err := h.DB.Where("service_id = ?", service.ID).Order("checked_at DESC").First(&latestCheck).Error

	// This checks whether the service has never been checked before.
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// This returns true because new services should be checked immediately.
		return true
	}

	// This checks whether another database error happened.
	if err != nil {
		// This logs the error instead of crashing the backend.
		log.Println("Failed to fetch latest health check:", err)

		// This returns false because it is safer to skip this service for now.
		return false
	}

	// This copies the service check interval into a local variable.
	intervalSeconds := service.CheckIntervalSeconds

	// This checks whether the interval is missing or invalid.
	if intervalSeconds <= 0 {
		// This uses the default interval as a safe fallback.
		intervalSeconds = monitoring.DefaultCheckIntervalSeconds
	}

	// This enforces the minimum interval even for older services already stored in the database.
	if intervalSeconds < monitoring.MinCheckIntervalSeconds {
		// This prevents very frequent checks from creating too many health check rows.
		intervalSeconds = monitoring.MinCheckIntervalSeconds
	}

	// This calculates the next time the service is allowed to be checked.
	nextCheckTime := latestCheck.CheckedAt.Add(time.Duration(intervalSeconds) * time.Second)

	// This returns true if the current time is after the next allowed check time.
	return time.Now().After(nextCheckTime)
}

// checkService sends an HTTP request to one service and stores the result.
func (h *HealthChecker) checkService(service models.Service) {
	// This records the start time so response time can be calculated.
	startTime := time.Now()

	// This protects existing database rows as well as newly submitted URLs.
	if err := monitoring.ValidateServiceURL(service.URL); err != nil {
		h.saveHealthCheck(service, "down", nil, nil, healthCheckErrorMessage(err))
		return
	}

	// This creates a GET request for the service URL.
	request, err := http.NewRequest(http.MethodGet, service.URL, nil)

	// This checks whether the request could not be created.
	if err != nil {
		// This records the service as down because the URL could not be requested.
		h.saveHealthCheck(service, "down", nil, nil, monitoring.ErrInvalidServiceURL.Error())

		// This stops the function because there is no valid request to send.
		return
	}

	// This sends the HTTP request to the monitored service.
	response, err := h.Client.Do(request)

	// This calculates how long the request took in milliseconds.
	responseTimeMs := int(time.Since(startTime).Milliseconds())

	// This checks whether the HTTP request failed completely.
	if err != nil {
		// This records the service as down because the request failed.
		h.saveHealthCheck(service, "down", nil, &responseTimeMs, healthCheckErrorMessage(err))

		// This stops the function because there is no successful response to inspect.
		return
	}

	// This makes sure the response body is closed after the check is finished.
	defer response.Body.Close()

	// This stores the returned HTTP status code.
	httpStatusCode := response.StatusCode

	// This starts with an empty error message.
	errorMessage := ""

	// This starts by assuming the service is online.
	status := "online"

	// This checks whether the returned status code does not match the expected status code.
	if httpStatusCode != service.ExpectedStatusCode {
		// This marks the service as down because it returned the wrong HTTP status code.
		status = "down"

		// This stores a useful error message explaining the status code mismatch.
		errorMessage = fmt.Sprintf("expected status %d but got %d", service.ExpectedStatusCode, httpStatusCode)

		// This checks whether the response was correct but too slow.
	} else if responseTimeMs > service.SlowThresholdMs {
		// This marks the service as slow because it took longer than the configured threshold.
		status = "slow"
	}

	// This saves the health check result in the database.
	h.saveHealthCheck(service, status, &httpStatusCode, &responseTimeMs, errorMessage)
}

func healthCheckErrorMessage(err error) string {
	switch {
	case errors.Is(err, monitoring.ErrBlockedDestination):
		return monitoring.ErrBlockedDestination.Error()
	case errors.Is(err, monitoring.ErrInvalidServiceURL):
		return monitoring.ErrInvalidServiceURL.Error()
	case errors.Is(err, monitoring.ErrDestinationResolution):
		return monitoring.ErrDestinationResolution.Error()
	default:
		return err.Error()
	}
}

// saveHealthCheck stores the check result and updates the service current status.
func (h *HealthChecker) saveHealthCheck(service models.Service, status string, httpStatusCode *int, responseTimeMs *int, errorMessage string) {
	// This creates a new health check record ready to be saved.
	healthCheck := models.HealthCheck{
		// This links the health check to the monitored service.
		ServiceID: service.ID,

		// This stores whether the service was online, slow or down.
		Status: status,

		// This stores the HTTP status code if one was received.
		HTTPStatusCode: httpStatusCode,

		// This stores the response time if one was measured.
		ResponseTimeMs: responseTimeMs,

		// This stores an error message if the check failed.
		ErrorMessage: errorMessage,

		// This stores the time the check was completed.
		CheckedAt: time.Now(),
	}

	// This stores the downtime alert if one is created during the transaction.
	var downtimeAlert *models.Alert

	// This runs the health check save, alert creation and service status update as one database transaction.
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		// This inserts the health check record into the health_checks table.
		if err := tx.Create(&healthCheck).Error; err != nil {
			// This returns the error so the transaction is rolled back.
			return fmt.Errorf("failed to save health check: %w", err)
		}

		// This creates an alert if the service has just moved into a down state.
		createdAlert, err := h.createDowntimeAlertIfNeeded(tx, service, status, healthCheck, errorMessage)

		// This checks whether alert creation failed.
		if err != nil {
			// This returns the error so the transaction is rolled back.
			return err
		}

		// This stores the alert so an email can be sent after the database transaction commits.
		downtimeAlert = createdAlert

		// This updates the current_status field on the monitored service.
		if err := tx.Model(&models.Service{}).Where("id = ?", service.ID).Update("current_status", status).Error; err != nil {
			// This returns the error so the transaction is rolled back.
			return fmt.Errorf("failed to update service current status: %w", err)
		}

		// This commits the transaction because all database writes succeeded.
		return nil
	})

	// This checks whether any part of the transaction failed.
	if err != nil {
		// This logs the transaction error without crashing the background worker.
		log.Println("Failed to store health check transaction:", err)

		// This stops because the database changes were rolled back.
		return
	}

	// This sends a downtime email only after the alert has been safely saved.
	if downtimeAlert != nil {
		// This sends the email asynchronously so SMTP delays do not block the health-check loop.
		h.sendDowntimeEmailAsync(service, *downtimeAlert, errorMessage)
	}

	// This starts with a zero duration in case the response time is missing.
	healthCheckDuration := time.Duration(0)

	// This converts the response time from milliseconds into a Go duration.
	if responseTimeMs != nil {
		healthCheckDuration = time.Duration(*responseTimeMs) * time.Millisecond
	}

	// This records the health check result for Prometheus after the database transaction succeeds.
	metrics.RecordHealthCheck(status, healthCheckDuration)

	// This logs the result of the health check.
	log.Printf("Checked service %s: %s", service.Name, status)
}

// createDowntimeAlertIfNeeded creates an alert when a service changes from not-down to down.
func (h *HealthChecker) createDowntimeAlertIfNeeded(tx *gorm.DB, service models.Service, status string, healthCheck models.HealthCheck, errorMessage string) (*models.Alert, error) {
	// This checks whether the latest check result is not down.
	if status != "down" {
		// This stops because we only create downtime alerts in this first version.
		return nil, nil
	}

	// This checks whether the service was already down before this check.
	if service.CurrentStatus == "down" {
		// This stops because we do not want duplicate alerts or duplicate emails while the service remains down.
		return nil, nil
	}

	// This creates a default message if the health checker did not provide one.
	if errorMessage == "" {
		// This gives the alert a useful fallback explanation.
		errorMessage = "The service failed its health check."
	}

	// This creates a short title for the alert.
	title := fmt.Sprintf("%s is down", service.Name)

	// This creates a longer message with the service URL and the failure reason.
	message := fmt.Sprintf("%s is currently down. URL: %s. Reason: %s", service.Name, service.URL, errorMessage)

	// This creates the alert record that will be saved in PostgreSQL.
	alert := models.Alert{
		// This stores the user who owns the service.
		UserID: service.UserID,

		// This stores the service that triggered the alert.
		ServiceID: service.ID,

		// This links the alert to the health check that triggered it.
		HealthCheckID: &healthCheck.ID,

		// This stores the alert type.
		Type: "service_down",

		// This marks downtime as a critical alert.
		Severity: "critical",

		// This stores the short alert title.
		Title: title,

		// This stores the detailed alert message.
		Message: message,
	}

	// This inserts the alert into the alerts table inside the same transaction as the health check and status update.
	if err := tx.Create(&alert).Error; err != nil {
		// This returns the error so the transaction can be rolled back.
		return nil, fmt.Errorf("failed to create downtime alert: %w", err)
	}

	// This logs that an alert was created.
	log.Printf("Created downtime alert for service %s", service.Name)

	// This returns the created alert so the caller can send an email after the transaction commits.
	return &alert, nil
}

// sendDowntimeEmailAsync sends a downtime notification without blocking the health-check loop.
func (h *HealthChecker) sendDowntimeEmailAsync(service models.Service, alert models.Alert, errorMessage string) {
	// This starts email sending in a separate goroutine so SMTP network I/O cannot block service checks.
	go func() {
		// This prevents an unexpected email panic from crashing the background worker.
		defer func() {
			// This checks whether the goroutine panicked.
			if recovered := recover(); recovered != nil {
				// This logs the panic instead of letting it crash the application.
				log.Printf("Recovered from downtime email panic for service %s: %v", service.Name, recovered)
			}
		}()

		// This sends or safely skips the downtime email.
		h.sendDowntimeEmail(service, alert, errorMessage)
	}()
}

// sendDowntimeEmail sends a downtime notification to the service owner.
func (h *HealthChecker) sendDowntimeEmail(service models.Service, alert models.Alert, errorMessage string) {
	// This checks whether the email sender was provided.
	if h.EmailSender == nil {
		// This logs the skipped email without crashing the health checker.
		log.Printf("Skipped downtime email for service %s because email sender is not configured", service.Name)
		return
	}

	// This creates a variable to store the service owner.
	var user models.User

	// This loads the service owner so the email can be sent to their account email address.
	if err := h.DB.First(&user, service.UserID).Error; err != nil {
		// This logs the failure without crashing the health checker.
		log.Printf("Failed to load user %d for downtime email: %v", service.UserID, err)
		return
	}

	// This creates a fallback failure reason if one was not provided.
	if errorMessage == "" {
		// This uses the alert message as a useful fallback.
		errorMessage = alert.Message
	}

	// This sends or safely skips the downtime email.
	if err := h.EmailSender.SendDowntimeAlertEmail(
		user.Email,
		service.Name,
		service.URL,
		errorMessage,
		alert.CreatedAt,
	); err != nil {
		// This logs the email failure without deleting the alert or crashing the worker.
		log.Printf("Failed to send downtime email for service %s to user %d: %v", service.Name, service.UserID, err)
		return
	}

	// This logs that the downtime email was handled.
	log.Printf("Downtime email handled for service %s", service.Name)
}
