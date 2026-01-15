package main

import (
	"fmt"
	"log"

	"oracle-backend/internal/api"

	"github.com/gin-gonic/gin"
)

func main() {
	// 创建Gin引擎
	router := gin.Default()

	// 设置CORS中间件
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// 注册路由
	api.SetupRoutes(router)

	// 启动服务器
	port := 8080
	log.Printf("Server starting on port %d...", port)
	if err := router.Run(fmt.Sprintf(":%d", port)); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
