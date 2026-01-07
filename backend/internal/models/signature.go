package models

import (
	"time"
)

// SignatureData 签名数据结构
type SignatureData struct {
	ProjectID    string   `json:"projectId"`
	DataDate     string   `json:"dataDate"`
	CoreDataHash string   `json:"coreDataHash"`
	FileHashes   []string `json:"fileHashes"`
	Timestamp    int64    `json:"timestamp"`
}

// HashResult 定义前端传递的哈希结果结构
type HashResult struct {
	FileName  string `json:"fileName"`
	FileSize  int64  `json:"fileSize"`
	HashValue string `json:"hashValue"`
}

// FileUploadResult 定义文件上传的返回结果
type FileUploadResult struct {
	FileName    string    `json:"file_name"`
	FileSize    int64     `json:"file_size"`
	FileHash    string    `json:"file_hash"`
	FilePath    string    `json:"file_path"`
	UploadTime  time.Time `json:"upload_time"`
	ContentType string    `json:"content_type"`
	Signer      string    `json:"signer"`
	Signature   string    `json:"signature"`
}

// UploadRequest 上传请求结构
type UploadRequest struct {
	ProjectID          string        `form:"projectId" binding:"required"`
	ProjectDescription string        `form:"projectDescription"`
	DataDate           string        `form:"dataDate" binding:"required"`
	CoreData           string        `form:"coreData"`
	HashResults        string        `form:"hashResults"`
	SignatureData      SignatureData `form:"signatureData"`
	Signature          string        `form:"signature" binding:"required"`
}
