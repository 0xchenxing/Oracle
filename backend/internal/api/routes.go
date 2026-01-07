package api

import (
	"github.com/gin-gonic/gin"
)

// SetupRoutes 配置所有API路由
func SetupRoutes(router *gin.Engine) {
	// 健康检查路由
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "Server is running",
		})
	})

	// 文件上传路由组
	uploadGroup := router.Group("/api")
	{
		uploadGroup.POST("/upload", UploadFile)
	}

	// 通过哈希值访问文件的路由
	router.GET("/attach/:hash", GetFileByHash)
}
