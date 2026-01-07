package service

import (
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/ethereum/go-ethereum/crypto"
)

// VerifySignature 验证以太坊签名并返回恢复的地址
func VerifySignature(message, signature string) (string, error) {
	// 1. 检查参数
	if message == "" || signature == "" {
		return "", fmt.Errorf("invalid parameters: message and signature are required")
	}

	// 2. 解码签名
	sigBytes, err := hex.DecodeString(strings.TrimPrefix(signature, "0x"))
	if err != nil {
		return "", fmt.Errorf("failed to decode signature: %w", err)
	}

	// 以太坊签名长度为65字节
	if len(sigBytes) != 65 {
		return "", fmt.Errorf("invalid signature length: %d, expected 65", len(sigBytes))
	}

	// 3. 计算消息哈希（以太坊签名使用 keccak256）
	// 注意：前端使用 signMessage 时，会自动添加 "\x19Ethereum Signed Message:\n" 前缀
	messageHash := crypto.Keccak256Hash([]byte("\x19Ethereum Signed Message:\n" + fmt.Sprintf("%d", len(message)) + message))

	// 4. 恢复公钥
	if sigBytes[64] > 1 {
		sigBytes[64] -= 27 // 转换为0或1
	}

	pubKey, err := crypto.SigToPub(messageHash.Bytes(), sigBytes)
	if err != nil {
		return "", fmt.Errorf("failed to recover public key: %w", err)
	}

	// 5. 计算并返回恢复的地址
	recoveredAddr := crypto.PubkeyToAddress(*pubKey)
	return recoveredAddr.Hex(), nil
}

// VerifySignatureWithParams 验证签名（包含自定义参数）
func VerifySignatureWithParams(projectId, dataDate, coreDataHash, fileHashes string, timestamp int64, signature string) (string, error) {
	// 转换为JSON字符串（保持与前端相同的格式）
	// 注意：这里需要使用与前端完全相同的JSON序列化方式
	message := fmt.Sprintf(`{"projectId":"%s","dataDate":"%s","coreDataHash":"%s","fileHashes":%s,"timestamp":%d}`,
		projectId, dataDate, coreDataHash, fileHashes, timestamp)

	return VerifySignature(message, signature)
}
