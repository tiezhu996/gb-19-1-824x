package database

import (
	"fmt"
	"log"

	"edu-train/config"
	"edu-train/models"
	"edu-train/utils"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Init(cfg *config.DBConfig) error {
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.User,
		cfg.Password,
		cfg.Host,
		cfg.Port,
		cfg.Name,
	)

	var gormLogger logger.Interface
	if config.Load().AppEnv == "debug" {
		gormLogger = logger.Default.LogMode(logger.Info)
	} else {
		gormLogger = logger.Default.LogMode(logger.Warn)
	}

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: gormLogger,
	})
	if err != nil {
		return err
	}

	DB = db

	log.Println("Database connected successfully")

	if err := migrate(); err != nil {
		return err
	}

	if err := seed(); err != nil {
		return err
	}

	return nil
}

func migrate() error {
	return DB.AutoMigrate(
		&models.User{},
		&models.Lead{},
		&models.FollowUp{},
		&models.Student{},
		&models.StudentCourse{},
		&models.Course{},
		&models.Classroom{},
		&models.Teacher{},
		&models.Schedule{},
		&models.Attendance{},
		&models.Payment{},
		&models.Refund{},
		&models.Performance{},
	)
}

func seed() error {
	var count int64
	DB.Model(&models.User{}).Count(&count)
	if count > 0 {
		return nil
	}

	adminPassword, _ := utils.HashPassword("admin123")

	users := []models.User{
		{
			Username: "admin",
			Password: adminPassword,
			Name:     "管理员",
			Role:     "admin",
			Email:    "admin@example.com",
			Phone:    "13800000000",
			Status:   1,
		},
		{
			Username: "teacher1",
			Password: adminPassword,
			Name:     "张老师",
			Role:     "teacher",
			Email:    "teacher1@example.com",
			Phone:    "13800000001",
			Status:   1,
		},
		{
			Username: "advisor1",
			Password: adminPassword,
			Name:     "李顾问",
			Role:     "advisor",
			Email:    "advisor1@example.com",
			Phone:    "13800000002",
			Status:   1,
		},
	}

	if err := DB.Create(&users).Error; err != nil {
		return err
	}

	courses := []models.Course{
		{Name: "英语一对一", Type: "one_on_one", PricePerHour: 200, TotalHours: 48, Description: "个性化一对一英语辅导", Status: 1},
		{Name: "数学小班课", Type: "small", PricePerHour: 120, TotalHours: 48, Description: "5-8人小班数学辅导", Status: 1},
		{Name: "语文大班课", Type: "large", PricePerHour: 80, TotalHours: 48, Description: "20人以内语文辅导", Status: 1},
	}
	if err := DB.Create(&courses).Error; err != nil {
		return err
	}

	classrooms := []models.Classroom{
		{Name: "教室A1", Capacity: 8, Location: "一楼", Status: 1},
		{Name: "教室A2", Capacity: 25, Location: "一楼", Status: 1},
		{Name: "教室B1", Capacity: 15, Location: "二楼", Status: 1},
	}
	if err := DB.Create(&classrooms).Error; err != nil {
		return err
	}

	teachers := []models.Teacher{
		{Name: "张老师", Phone: "13800000001", Qualification: "英语专业八级", Subjects: "英语", HourlyRate: 150, Status: 1, UserID: &users[1].ID},
		{Name: "王老师", Phone: "13800000003", Qualification: "数学硕士", Subjects: "数学", HourlyRate: 180, Status: 1},
		{Name: "刘老师", Phone: "13800000004", Qualification: "语文高级教师", Subjects: "语文", HourlyRate: 160, Status: 1},
	}
	if err := DB.Create(&teachers).Error; err != nil {
		return err
	}

	return nil
}
