package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/Umar-iht654/Cloud-DevOps-Monitoring-Dashboard/backend/internal/models"
	"github.com/Umar-iht654/Cloud-DevOps-Monitoring-Dashboard/backend/internal/monitoring"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ServiceHandler stores the dependencies needed by the service routes.
type ServiceHandler struct {
	// DB gives the service handler access to the PostgreSQL database through GORM.
	DB *gorm.DB
}

// CreateServiceRequest defines the JSON body expected when a user creates a service.
type CreateServiceRequest struct {
	// Name stores the display name of the monitored service.
	Name string `json:"name"`

	// URL stores the service URL that will be checked by the monitoring system.
	URL string `json:"url"`

	// ExpectedStatusCode stores the HTTP status code that counts as healthy.
	ExpectedStatusCode int `json:"expected_status_code"`

	// SlowThresholdMs stores the response time limit before a service is considered slow.
	SlowThresholdMs int `json:"slow_threshold_ms"`

	// CheckIntervalSeconds stores how often the service should be checked.
	CheckIntervalSeconds int `json:"check_interval_seconds"`
}

// UpdateServiceRequest defines the JSON body expected when a user updates a service.
type UpdateServiceRequest struct {
	// Name optionally stores the updated service name.
	Name *string `json:"name"`

	// URL optionally stores the updated service URL.
	URL *string `json:"url"`

	// ExpectedStatusCode optionally stores the updated expected HTTP status code.
	ExpectedStatusCode *int `json:"expected_status_code"`

	// SlowThresholdMs optionally stores the updated slow response threshold.
	SlowThresholdMs *int `json:"slow_threshold_ms"`

	// CheckIntervalSeconds optionally stores the updated check interval.
	CheckIntervalSeconds *int `json:"check_interval_seconds"`
}

// NewServiceHandler creates a new ServiceHandler with database access.
func NewServiceHandler(db *gorm.DB) *ServiceHandler {
	// This returns a pointer to a ServiceHandler so routes can use its methods.
	return &ServiceHandler{
		DB: db,
	}
}

// getUserIDFromContext gets the authenticated user's ID from the Gin request context.
func getUserIDFromContext(c *gin.Context) (uint, bool) {
	// This gets the userID value that was added by the JWT auth middleware.
	userIDValue, exists := c.Get("userID")

	// This checks whether the userID exists in the request context.
	if !exists {
		// This returns zero and false because the user is not authenticated.
		return 0, false
	}

	// This converts the userID value into a uint.
	userID, ok := userIDValue.(uint)

	// This checks whether the userID was stored in the expected type.
	if !ok {
		// This returns zero and false because the userID is invalid.
		return 0, false
	}

	// This returns the authenticated user's ID and true because it was found successfully.
	return userID, true
}

// CreateService handles creating a new monitored service.
func (h *ServiceHandler) CreateService(c *gin.Context) {
	// This gets the authenticated user's ID from the request context.
	userID, ok := getUserIDFromContext(c)

	// This checks whether the user ID was missing or invalid.
	if !ok {
		// This returns a 401 response because the user is not authenticated.
		c.JSON(http.StatusUnauthorized, gin.H{
			"message": "User is not authenticated",
		})

		// This stops the handler because a service cannot be created without a user.
		return
	}

	// This creates a variable to store the incoming JSON request body.
	var req CreateServiceRequest

	// This tries to convert the incoming JSON body into the CreateServiceRequest struct.
	if err := c.ShouldBindJSON(&req); err != nil {
		// This returns a 400 response if the request body is invalid.
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid request body",
		})

		// This stops the handler because the request body could not be read.
		return
	}

	// This removes extra spaces before or after the service name.
	req.Name = strings.TrimSpace(req.Name)

	// This removes extra spaces before or after the service URL.
	req.URL = strings.TrimSpace(req.URL)

	// This checks that the service name was provided.
	if req.Name == "" {
		// This returns a 400 response because the service name is required.
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Service name is required",
		})

		// This stops the handler because the service name is missing.
		return
	}

	// This checks that the service URL was provided.
	if req.URL == "" {
		// This returns a 400 response because the service URL is required.
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Service URL is required",
		})

		// This stops the handler because the service URL is missing.
		return
	}

	// This checks URL syntax, scheme, and any literal destination address.
	if err := monitoring.ValidateServiceURL(req.URL); err != nil {
		// This returns a safe validation message without exposing network details.
		c.JSON(http.StatusBadRequest, gin.H{
			"message": err.Error(),
		})

		// This stops the handler because the service cannot be monitored with an invalid URL.
		return
	}

	// This sets the default expected status code if the user did not provide one.
	if req.ExpectedStatusCode == 0 {
		req.ExpectedStatusCode = 200
	}

	// This sets the default slow threshold if the user did not provide one.
	if req.SlowThresholdMs == 0 {
		req.SlowThresholdMs = 750
	}

	// This sets the default check interval if the user did not provide one.
	if req.CheckIntervalSeconds == 0 {
		req.CheckIntervalSeconds = monitoring.DefaultCheckIntervalSeconds
	}

	// This checks that the expected status code is within a realistic HTTP status code range.
	if req.ExpectedStatusCode < 100 || req.ExpectedStatusCode > 599 {
		// This returns a 400 response because the status code is invalid.
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Expected status code must be between 100 and 599",
		})

		// This stops the handler because the status code is invalid.
		return
	}

	// This checks that the slow threshold is greater than zero.
	if req.SlowThresholdMs <= 0 {
		// This returns a 400 response because the slow threshold is invalid.
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Slow threshold must be greater than 0 milliseconds",
		})

		// This stops the handler because the slow threshold is invalid.
		return
	}

	// This checks that the check interval is not too frequent.
	if req.CheckIntervalSeconds < monitoring.MinCheckIntervalSeconds {
		// This returns a 400 response because very frequent checks would create too much database noise.
		c.JSON(http.StatusBadRequest, gin.H{
			"message": fmt.Sprintf("Check interval must be at least %d seconds", monitoring.MinCheckIntervalSeconds),
		})

		// This stops the handler because the check interval is invalid.
		return
	}

	// This creates a new Service model ready to be saved in the database.
	service := models.Service{
		UserID:               userID,
		Name:                 req.Name,
		URL:                  req.URL,
		ExpectedStatusCode:   req.ExpectedStatusCode,
		SlowThresholdMs:      req.SlowThresholdMs,
		CheckIntervalSeconds: req.CheckIntervalSeconds,
		CurrentStatus:        "unknown",
	}

	// This inserts the new service into the services table.
	if err := h.DB.Create(&service).Error; err != nil {
		// This returns a 500 response if the service could not be saved.
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to create service",
		})

		// This stops the handler because service creation failed.
		return
	}

	// This returns a 201 response with the newly created service.
	c.JSON(http.StatusCreated, gin.H{
		"message": "Service created successfully",
		"service": service,
	})
}

// GetServices returns all monitored services owned by the authenticated user.
func (h *ServiceHandler) GetServices(c *gin.Context) {
	// This gets the authenticated user's ID from the request context.
	userID, ok := getUserIDFromContext(c)

	// This checks whether the user ID was missing or invalid.
	if !ok {
		// This returns a 401 response because the user is not authenticated.
		c.JSON(http.StatusUnauthorized, gin.H{
			"message": "User is not authenticated",
		})

		// This stops the handler because services cannot be loaded without a user.
		return
	}

	// This creates a slice to store all services found for the authenticated user.
	var services []models.Service

	// This gets all services belonging to the authenticated user and orders newest first.
	if err := h.DB.Where("user_id = ?", userID).Order("created_at DESC").Find(&services).Error; err != nil {
		// This returns a 500 response if the database query fails.
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to fetch services",
		})

		// This stops the handler because services could not be loaded.
		return
	}

	// This returns the authenticated user's services.
	c.JSON(http.StatusOK, gin.H{
		"services": services,
	})
}

// GetService returns one monitored service owned by the authenticated user.
func (h *ServiceHandler) GetService(c *gin.Context) {
	// This gets the authenticated user's ID from the request context.
	userID, ok := getUserIDFromContext(c)

	// This checks whether the user ID was missing or invalid.
	if !ok {
		// This returns a 401 response because the user is not authenticated.
		c.JSON(http.StatusUnauthorized, gin.H{
			"message": "User is not authenticated",
		})

		// This stops the handler because a service cannot be loaded without a user.
		return
	}

	// This reads the service ID from the URL parameter.
	serviceIDParam := c.Param("id")

	// This converts the service ID from a string into an unsigned integer.
	serviceID, err := strconv.ParseUint(serviceIDParam, 10, 64)

	// This checks whether the service ID was invalid.
	if err != nil {
		// This returns a 400 response because the service ID is not valid.
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid service ID",
		})

		// This stops the handler because the service cannot be loaded with an invalid ID.
		return
	}

	// This creates a variable to store the service found in the database.
	var service models.Service

	// This searches for a service with the matching ID and authenticated user ID.
	err = h.DB.Where("id = ? AND user_id = ?", serviceID, userID).First(&service).Error

	// This checks whether the service was not found.
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// This returns a 404 response if the service does not exist or does not belong to the user.
		c.JSON(http.StatusNotFound, gin.H{
			"message": "Service not found",
		})

		// This stops the handler because there is no service to return.
		return
	}

	// This checks whether another database error happened.
	if err != nil {
		// This returns a 500 response if the database query failed.
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to fetch service",
		})

		// This stops the handler because the service could not be loaded.
		return
	}

	// This returns the requested service.
	c.JSON(http.StatusOK, gin.H{
		"service": service,
	})
}

// UpdateService updates one monitored service owned by the authenticated user.
func (h *ServiceHandler) UpdateService(c *gin.Context) {
	// This gets the authenticated user's ID from the request context.
	userID, ok := getUserIDFromContext(c)

	// This checks whether the user ID was missing or invalid.
	if !ok {
		// This returns a 401 response because the user is not authenticated.
		c.JSON(http.StatusUnauthorized, gin.H{
			"message": "User is not authenticated",
		})

		// This stops the handler because a service cannot be updated without a user.
		return
	}

	// This reads the service ID from the URL parameter.
	serviceIDParam := c.Param("id")

	// This converts the service ID from a string into an unsigned integer.
	serviceID, err := strconv.ParseUint(serviceIDParam, 10, 64)

	// This checks whether the service ID was invalid.
	if err != nil {
		// This returns a 400 response because the service ID is not valid.
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid service ID",
		})

		// This stops the handler because the service cannot be updated with an invalid ID.
		return
	}

	// This creates a variable to store the service found in the database.
	var service models.Service

	// This searches for a service with the matching ID and authenticated user ID.
	err = h.DB.Where("id = ? AND user_id = ?", serviceID, userID).First(&service).Error

	// This checks whether the service was not found.
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// This returns a 404 response if the service does not exist or does not belong to the user.
		c.JSON(http.StatusNotFound, gin.H{
			"message": "Service not found",
		})

		// This stops the handler because there is no service to update.
		return
	}

	// This checks whether another database error happened.
	if err != nil {
		// This returns a 500 response if the database query failed.
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to fetch service",
		})

		// This stops the handler because the service could not be loaded.
		return
	}

	// This creates a variable to store the incoming JSON request body.
	var req UpdateServiceRequest

	// This tries to convert the incoming JSON body into the UpdateServiceRequest struct.
	if err := c.ShouldBindJSON(&req); err != nil {
		// This returns a 400 response if the request body is invalid.
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid request body",
		})

		// This stops the handler because the update body could not be read.
		return
	}

	// This checks whether a new name was provided.
	if req.Name != nil {
		// This removes extra spaces before or after the new name.
		trimmedName := strings.TrimSpace(*req.Name)

		// This checks whether the new name is empty.
		if trimmedName == "" {
			// This returns a 400 response because the service name cannot be empty.
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "Service name cannot be empty",
			})

			// This stops the handler because the new name is invalid.
			return
		}

		// This updates the service name.
		service.Name = trimmedName
	}

	// This checks whether a new URL was provided.
	if req.URL != nil {
		// This removes extra spaces before or after the new URL.
		trimmedURL := strings.TrimSpace(*req.URL)

		// This checks whether the new URL is empty.
		if trimmedURL == "" {
			// This returns a 400 response because the service URL cannot be empty.
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "Service URL cannot be empty",
			})

			// This stops the handler because the new URL is invalid.
			return
		}

		// This checks URL syntax, scheme, and any literal destination address.
		if err := monitoring.ValidateServiceURL(trimmedURL); err != nil {
			// This returns a safe validation message without exposing network details.
			c.JSON(http.StatusBadRequest, gin.H{
				"message": err.Error(),
			})

			// This stops the handler because the service cannot be monitored with an invalid URL.
			return
		}

		// This updates the service URL.
		service.URL = trimmedURL
	}

	// This checks whether a new expected status code was provided.
	if req.ExpectedStatusCode != nil {
		// This checks whether the new expected status code is realistic.
		if *req.ExpectedStatusCode < 100 || *req.ExpectedStatusCode > 599 {
			// This returns a 400 response because the status code is invalid.
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "Expected status code must be between 100 and 599",
			})

			// This stops the handler because the status code is invalid.
			return
		}

		// This updates the expected status code.
		service.ExpectedStatusCode = *req.ExpectedStatusCode
	}

	// This checks whether a new slow threshold was provided.
	if req.SlowThresholdMs != nil {
		// This checks that the slow threshold is greater than zero.
		if *req.SlowThresholdMs <= 0 {
			// This returns a 400 response because the slow threshold is invalid.
			c.JSON(http.StatusBadRequest, gin.H{
				"message": "Slow threshold must be greater than 0 milliseconds",
			})

			// This stops the handler because the slow threshold is invalid.
			return
		}

		// This updates the slow response threshold.
		service.SlowThresholdMs = *req.SlowThresholdMs
	}

	// This checks whether a new check interval was provided.
	if req.CheckIntervalSeconds != nil {
		// This checks that the new check interval is not too frequent.
		if *req.CheckIntervalSeconds < monitoring.MinCheckIntervalSeconds {
			// This returns a 400 response because very frequent checks would create too much database noise.
			c.JSON(http.StatusBadRequest, gin.H{
				"message": fmt.Sprintf("Check interval must be at least %d seconds", monitoring.MinCheckIntervalSeconds),
			})

			// This stops the handler because the check interval is invalid.
			return
		}

		// This updates the check interval.
		service.CheckIntervalSeconds = *req.CheckIntervalSeconds
	}

	// This saves the updated service back to the database.
	if err := h.DB.Save(&service).Error; err != nil {
		// This returns a 500 response if the service could not be updated.
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to update service",
		})

		// This stops the handler because the update failed.
		return
	}

	// This returns the updated service.
	c.JSON(http.StatusOK, gin.H{
		"message": "Service updated successfully",
		"service": service,
	})
}

// DeleteService deletes one monitored service owned by the authenticated user.
func (h *ServiceHandler) DeleteService(c *gin.Context) {
	// This gets the authenticated user's ID from the request context.
	userID, ok := getUserIDFromContext(c)

	// This checks whether the user ID was missing or invalid.
	if !ok {
		// This returns a 401 response because the user is not authenticated.
		c.JSON(http.StatusUnauthorized, gin.H{
			"message": "User is not authenticated",
		})

		// This stops the handler because a service cannot be deleted without a user.
		return
	}

	// This reads the service ID from the URL parameter.
	serviceIDParam := c.Param("id")

	// This converts the service ID from a string into an unsigned integer.
	serviceID, err := strconv.ParseUint(serviceIDParam, 10, 64)

	// This checks whether the service ID was invalid.
	if err != nil {
		// This returns a 400 response because the service ID is not valid.
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "Invalid service ID",
		})

		// This stops the handler because the service cannot be deleted with an invalid ID.
		return
	}

	// This creates a variable to store the service found in the database.
	var service models.Service

	// This searches for a service with the matching ID and authenticated user ID.
	err = h.DB.Where("id = ? AND user_id = ?", serviceID, userID).First(&service).Error

	// This checks whether the service was not found.
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// This returns a 404 response if the service does not exist or does not belong to the user.
		c.JSON(http.StatusNotFound, gin.H{
			"message": "Service not found",
		})

		// This stops the handler because there is no service to delete.
		return
	}

	// This checks whether another database error happened.
	if err != nil {
		// This returns a 500 response if the database query failed.
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to fetch service",
		})

		// This stops the handler because the service could not be loaded.
		return
	}

	// This deletes the service from the database.
	if err := h.DB.Delete(&service).Error; err != nil {
		// This returns a 500 response if the service could not be deleted.
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Failed to delete service",
		})

		// This stops the handler because deletion failed.
		return
	}

	// This returns a success response after the service is deleted.
	c.JSON(http.StatusOK, gin.H{
		"message": "Service deleted successfully",
	})
}
