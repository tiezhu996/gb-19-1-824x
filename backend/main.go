package main

import (
	"log"
	"net/http"

	"edu-train/config"
	"edu-train/controllers"
	"edu-train/database"
	"edu-train/middleware"
	"edu-train/utils"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	if cfg.AppEnv == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	if err := database.Init(&cfg.DBConfig); err != nil {
		log.Printf("Database initialization failed, server will start with limited API functionality: %v", err)
	}

	if err := database.InitRedis(&cfg.RedisConfig); err != nil {
		log.Printf("Redis initialization failed: %v", err)
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":   "ok",
			"database": database.DB != nil,
		})
	})

	api := r.Group("/api")
	api.Use(func(c *gin.Context) {
		if database.DB == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "数据库暂不可用，请检查数据库配置"})
			c.Abort()
			return
		}
		c.Next()
	})

	auth := api.Group("/auth")
	{
		auth.POST("/login", func(c *gin.Context) {
			controllers.Login(c, cfg.JWTSecret, cfg.JWTExpire)
		})
	}

	api.Use(middleware.AuthMiddleware(cfg.JWTSecret))

	api.GET("/user/me", controllers.GetCurrentUser)
	api.POST("/user/password", controllers.ChangePassword)

	api.GET("/users", controllers.GetUsers)

	leads := api.Group("/leads")
	{
		leads.GET("", controllers.GetLeads)
		leads.POST("", controllers.CreateLead)
		leads.GET("/:id", controllers.GetLead)
		leads.PUT("/:id", controllers.UpdateLead)
		leads.DELETE("/:id", controllers.DeleteLead)
		leads.POST("/:id/assign", controllers.AssignLead)
		leads.POST("/:id/followup", controllers.FollowUpLead)
		leads.POST("/:id/convert", controllers.ConvertToStudent)
	}

	students := api.Group("/students")
	{
		students.GET("", controllers.GetStudents)
		students.POST("", controllers.CreateStudent)
		students.GET("/:id", controllers.GetStudent)
		students.PUT("/:id", controllers.UpdateStudent)
		students.DELETE("/:id", controllers.DeleteStudent)
		students.POST("/:id/tags", controllers.AddStudentTag)
		students.DELETE("/:id/tags", controllers.RemoveStudentTag)
	}

	courses := api.Group("/courses")
	{
		courses.GET("", controllers.GetCourses)
		courses.POST("", controllers.CreateCourse)
		courses.GET("/:id", controllers.GetCourse)
		courses.PUT("/:id", controllers.UpdateCourse)
		courses.DELETE("/:id", controllers.DeleteCourse)
	}

	classrooms := api.Group("/classrooms")
	{
		classrooms.GET("", controllers.GetClassrooms)
		classrooms.POST("", controllers.CreateClassroom)
		classrooms.PUT("/:id", controllers.UpdateClassroom)
		classrooms.DELETE("/:id", controllers.DeleteClassroom)
	}

	teachers := api.Group("/teachers")
	{
		teachers.GET("", controllers.GetTeachers)
		teachers.POST("", controllers.CreateTeacher)
		teachers.GET("/:id", controllers.GetTeacher)
		teachers.PUT("/:id", controllers.UpdateTeacher)
		teachers.DELETE("/:id", controllers.DeleteTeacher)
	}

	performances := api.Group("/performances")
	{
		performances.GET("", controllers.GetTeacherPerformances)
	}

	schedules := api.Group("/schedules")
	{
		schedules.GET("", controllers.GetSchedules)
		schedules.POST("", controllers.CreateSchedule)
		schedules.GET("/:id", controllers.GetSchedule)
		schedules.PUT("/:id", controllers.UpdateSchedule)
		schedules.DELETE("/:id", controllers.DeleteSchedule)
		schedules.POST("/:id/attendance", controllers.TakeAttendance)
	}

	api.GET("/student-schedules", controllers.GetStudentSchedule)

	payments := api.Group("/payments")
	{
		payments.GET("", controllers.GetPayments)
		payments.POST("", controllers.CreatePayment)
		payments.GET("/:id", controllers.GetPayment)
		payments.PUT("/:id", controllers.UpdatePayment)
		payments.DELETE("/:id", controllers.DeletePayment)
	}

	refunds := api.Group("/refunds")
	{
		refunds.GET("", controllers.GetRefunds)
		refunds.POST("", controllers.CreateRefund)
		refunds.POST("/:id/process", controllers.ProcessRefund)
	}

	api.GET("/finance/reports", controllers.GetFinanceReports)

	dashboard := api.Group("/dashboard")
	{
		dashboard.GET("/stats", controllers.GetDashboardStats)
		dashboard.GET("/charts", controllers.GetDashboardCharts)
	}

	_ = utils.HashPassword

	log.Printf("Server starting on port %s...", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
