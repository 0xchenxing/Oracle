package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"oracle-backend/internal/models"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// UploadFile 处理文件上传的业务逻辑
func UploadFile(file multipart.File, header *multipart.FileHeader, projectId, projectDescription, hashResults,
	signatureDataStr, signature string) (*models.FileUploadResult, error) {
	// 1. 验证签名
	if signatureDataStr == "" || signature == "" {
		return nil, fmt.Errorf("签名数据不完整")
	}

	// 解析签名数据
	var sigData models.SignatureData
	if err := json.Unmarshal([]byte(signatureDataStr), &sigData); err != nil {
		return nil, fmt.Errorf("签名数据解析失败: %w", err)
	}

	// 验证签名并恢复地址
	fileHashesJSON, err := json.Marshal(sigData.FileHashes)
	if err != nil {
		return nil, fmt.Errorf("文件哈希数组序列化失败: %w", err)
	}
	recoveredAddress, err := VerifySignatureWithParams(
		sigData.ProjectID,
		sigData.DataDate,
		sigData.CoreDataHash,
		string(fileHashesJSON),
		sigData.Timestamp,
		signature,
	)

	if err != nil {
		return nil, fmt.Errorf("签名验证失败: %w", err)
	}

	// 使用从签名中恢复的地址检查合约权限
	isAuthorized, err := CheckContractAuthorization(recoveredAddress, projectId)
	if err != nil {
		return nil, fmt.Errorf("合约权限检查失败: %w", err)
	}
	if !isAuthorized {
		return nil, fmt.Errorf("地址未授权: %s 不是项目 %s 的所有者或授权提交者", recoveredAddress, projectId)
	}

	// 2. 检查签名时间戳（防止重放攻击）
	now := time.Now().UnixNano() / int64(time.Millisecond)
	if now-sigData.Timestamp > 300000 { // 5分钟有效期
		return nil, fmt.Errorf("签名已过期")
	}

	// 3. 验证项目ID和数据日期与签名数据一致
	if sigData.ProjectID != projectId {
		return nil, fmt.Errorf("项目ID与签名数据不一致")
	}

	// 4. 验证文件哈希与签名数据一致
	var frontEndHashResults []models.HashResult
	if err := json.Unmarshal([]byte(hashResults), &frontEndHashResults); err == nil {
		// 验证文件数量一致
		if len(sigData.FileHashes) != len(frontEndHashResults) {
			return nil, fmt.Errorf("文件哈希数量与签名数据不一致")
		}

		// 验证每个文件的哈希值
		for i, result := range frontEndHashResults {
			cleanHash := result.HashValue
			if strings.HasPrefix(cleanHash, "0x") {
				cleanHash = cleanHash[2:]
			}

			if i < len(sigData.FileHashes) && sigData.FileHashes[i] != cleanHash {
				return nil, fmt.Errorf("文件哈希与签名数据不一致: %s", result.FileName)
			}
		}
	}

	// 5. 继续原有的文件处理逻辑
	fileContent, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	// 重置文件指针
	if _, err := file.Seek(0, 0); err != nil {
		return nil, fmt.Errorf("failed to reset file pointer: %w", err)
	}

	// 计算文件哈希
	hash := sha256.New()
	if _, err := hash.Write(fileContent); err != nil {
		return nil, fmt.Errorf("failed to calculate hash: %w", err)
	}
	hashInBytes := hash.Sum(nil)
	backendFileHash := hex.EncodeToString(hashInBytes)

	// 使用后端计算的哈希值作为默认值
	fileHash := backendFileHash

	// 尝试使用前端传递的哈希值
	if hashResults != "" {
		var frontEndHashResults []models.HashResult
		if err := json.Unmarshal([]byte(hashResults), &frontEndHashResults); err == nil {
			for _, result := range frontEndHashResults {
				if result.FileName == header.Filename {
					fileHash = result.HashValue
					if len(fileHash) == 66 && fileHash[:2] == "0x" {
						fileHash = fileHash[2:]
					}

					// 验证哈希是否匹配
					if fileHash != backendFileHash {
						return nil, fmt.Errorf("文件哈希不匹配: %s (前端: %s, 后端: %s)",
							header.Filename, fileHash, backendFileHash)
					}
					break
				}
			}
		}
	}

	// 6. 保存文件（保持不变）
	projectDirName := projectId
	if projectDescription != "" {
		projectDirName = fmt.Sprintf("%s-%s", projectId, sanitizeFileName(projectDescription))
	}

	cwd, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("failed to get current working directory: %w", err)
	}

	var backendRoot string
	if strings.Contains(cwd, "backend") {
		backendIndex := strings.LastIndex(cwd, "backend")
		backendRoot = cwd[:backendIndex+len("backend")]
	} else {
		potentialBackend := filepath.Join(cwd, "backend")
		if _, err := os.Stat(potentialBackend); err == nil {
			backendRoot = potentialBackend
		} else {
			backendRoot = cwd
		}
	}

	if _, err := os.Stat(backendRoot); os.IsNotExist(err) {
		if err := os.MkdirAll(backendRoot, 0755); err != nil {
			return nil, fmt.Errorf("failed to create backend directory: %w", err)
		}
	}

	uploadDir := filepath.Join(backendRoot, "uploads", projectDirName)
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create project directory: %w", err)
		}
	}

	timestamp := time.Now().UnixNano() / int64(time.Millisecond)
	uniqueFileName := fmt.Sprintf("%s_%d_%s", fileHash, timestamp, header.Filename)
	filePath := filepath.Join(uploadDir, uniqueFileName)

	dst, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dst.Close()

	if _, err := dst.Write(fileContent); err != nil {
		return nil, fmt.Errorf("failed to save file: %w", err)
	}

	// 7. 返回结果
	result := &models.FileUploadResult{
		FileName:    header.Filename,
		FileSize:    header.Size,
		FileHash:    fileHash,
		FilePath:    filePath,
		UploadTime:  time.Now(),
		ContentType: header.Header.Get("Content-Type"),
		Signer:      recoveredAddress,
		Signature:   signature,
	}

	return result, nil
}

// sanitizeFileName 清理文件名中的特殊字符，确保安全
func sanitizeFileName(name string) string {
	// 创建一个字符映射，将不安全的字符替换为下划线
	var result []rune
	for _, char := range name {
		// 允许字母、数字、下划线、连字符和中文字符
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') || char == '_' || char == '-' ||
			(char >= 0x4e00 && char <= 0x9fa5) {
			result = append(result, char)
		} else {
			// 不安全的字符替换为下划线
			result = append(result, '_')
		}
	}
	return string(result)
}
