package api

import (
	"fmt"
	"net/http"
	"oracle-backend/internal/models"
	"oracle-backend/internal/service"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// UploadFile 处理文件上传请求
func UploadFile(c *gin.Context) {
	// 获取表单数据
	projectId := c.PostForm("projectId")
	projectDescription := c.PostForm("projectDescription")
	dataDate := c.PostForm("dataDate")
	coreData := c.PostForm("coreData")
	hashResults := c.PostForm("hashResults")

	// 新增：获取签名相关数据
	signatureData := c.PostForm("signatureData")
	signature := c.PostForm("signature")

	// 验证必要参数
	if signatureData == "" || signature == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "签名数据不完整",
			"details": "请提供完整的签名数据",
		})
		return
	}

	// 获取上传的文件
	multipartForm, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Failed to parse multipart form",
			"details": err.Error(),
		})
		return
	}
	files := multipartForm.File["files"]

	var results []*models.FileUploadResult

	// 处理每个上传的文件
	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "Failed to open file",
				"details": err.Error(),
			})
			return
		}
		defer file.Close()

		// 调用服务层处理文件上传，传递签名相关数据
		result, err := service.UploadFile(file, fileHeader, projectId, projectDescription, hashResults, signatureData, signature)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "上传失败",
				"details": err.Error(),
			})
			return
		}

		results = append(results, result)
	}

	// 返回成功响应
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"projectId":          projectId,
			"projectDescription": projectDescription,
			"dataDate":           dataDate,
			"coreData":           coreData,
			"hashResults":        hashResults,
			"signerAddress":      results[0].Signer, // 使用从签名中恢复的地址
			"uploadedFiles":      results,
		},
	})
}

// GetFileByHash 根据文件哈希值获取文件
func GetFileByHash(c *gin.Context) {
	// 获取哈希参数
	hash := c.Param("hash")
	if hash == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "File hash is required",
		})
		return
	}

	// 查找包含该哈希值的文件
	filePath, err := findFileByHash(hash)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "File not found",
			"details": err.Error(),
		})
		return
	}

	// 提供文件下载
	c.File(filePath)
}

// findFileByHash 根据哈希值查找文件
func findFileByHash(hash string) (string, error) {
	// 获取当前工作目录
	cwd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get current working directory: %w", err)
	}

	// 构建正确的uploads目录路径：确保uploads目录始终在backend目录下
	var backendRoot string

	// 检查当前工作目录是否包含backend目录
	if strings.Contains(cwd, "backend") {
		// 找到backend目录的位置
		backendIndex := strings.LastIndex(cwd, "backend")
		backendRoot = cwd[:backendIndex+len("backend")]
	} else {
		// 如果当前目录不包含backend目录，假设backend目录在当前目录的子目录中
		backendRoot = filepath.Join(cwd, "backend")
	}

	// 创建uploads目录路径
	uploadsDir := filepath.Join(backendRoot, "uploads")

	var foundFilePath string
	err = filepath.Walk(uploadsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 跳过目录
		if info.IsDir() {
			return nil
		}

		// 检查文件名是否包含指定的哈希值
		// 文件名格式: 完整哈希_timestamp_原始文件名
		prefixMatch := strings.HasPrefix(info.Name(), hash+"_")
		fullMatch := strings.Contains(info.Name(), "_"+hash+".")

		if prefixMatch || fullMatch {
			// 检查完整哈希的匹配
			foundFilePath = path
			return filepath.SkipDir // 找到第一个匹配的文件后停止遍历
		}

		return nil
	})

	if err != nil {
		return "", err
	}

	if foundFilePath == "" {
		return "", fmt.Errorf("no file found with hash: %s", hash)
	}

	return foundFilePath, nil
}
