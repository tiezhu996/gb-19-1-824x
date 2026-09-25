package config

import (
	"os"
	"strconv"
)

type Config struct {
	AppEnv      string
	Port        string
	JWTSecret   string
	JWTExpire   int
	DBConfig    DBConfig
	RedisConfig RedisConfig
	LogLevel    string
}

type DBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
}

type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

func Load() *Config {
	return &Config{
		AppEnv:    getEnv("APP_ENV", "debug"),
		Port:      getEnv("PORT", "3000"),
		JWTSecret: getEnv("JWT_SECRET", "your-secret-key-change-in-production"),
		JWTExpire: getEnvInt("JWT_EXPIRE_HOURS", 24),
		DBConfig: DBConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnv("DB_PORT", "3306"),
			User:     getEnv("DB_USER", "root"),
			Password: getEnv("DB_PASSWORD", ""),
			Name:     getEnv("DB_NAME", "edu_train"),
		},
		RedisConfig: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnv("REDIS_PORT", "6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvInt("REDIS_DB", 0),
		},
		LogLevel: getEnv("LOG_LEVEL", "info"),
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}
