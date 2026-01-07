package service

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

// 定义合约ABI（仅包含isAuthorizedSubmitter函数）
const oracleABI = `[
    {
        "inputs": [
            {"internalType": "bytes32", "name": "pid", "type": "bytes32"},
            {"internalType": "address", "name": "submitter", "type": "address"}
        ],
        "name": "isAuthorizedSubmitter",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    }
]`

// OracleClient 封装Oracle智能合约的调用
type OracleClient struct {
	client          *ethclient.Client
	contractAddress common.Address
	contractABI     abi.ABI
}

// NewOracleClient 创建OracleClient实例
// rpcURL: 以太坊节点RPC地址
// contractAddress: 智能合约地址
func NewOracleClient(rpcURL, contractAddress string) (*OracleClient, error) {
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Ethereum node: %w", err)
	}

	address := common.HexToAddress(contractAddress)

	parsedABI, err := abi.JSON(strings.NewReader(oracleABI))
	if err != nil {
		return nil, fmt.Errorf("failed to parse ABI: %w", err)
	}

	return &OracleClient{
		client:          client,
		contractAddress: address,
		contractABI:     parsedABI,
	}, nil
}

// Close 关闭以太坊客户端连接
func (oc *OracleClient) Close() {
	if oc.client != nil {
		oc.client.Close()
	}
}

// IsAuthorizedSubmitter 检查提交者是否被授权提交数据
// pid: 项目ID (bytes32)
// submitter: 提交者地址
func (oc *OracleClient) IsAuthorizedSubmitter(pid [32]byte, submitter common.Address) (bool, error) {
	// 准备函数调用数据
	callData, err := oc.contractABI.Pack("isAuthorizedSubmitter", pid, submitter)
	if err != nil {
		return false, fmt.Errorf("failed to pack call data: %w", err)
	}

	// 创建消息调用
	msg := ethereum.CallMsg{
		To:   &oc.contractAddress,
		Data: callData,
	}

	// 执行调用
	result, err := oc.client.CallContract(context.Background(), msg, nil)
	if err != nil {
		return false, fmt.Errorf("failed to call contract: %w", err)
	}

	// 解析返回结果
	var isAuthorized bool
	err = oc.contractABI.UnpackIntoInterface(&isAuthorized, "isAuthorizedSubmitter", result)
	if err != nil {
		return false, fmt.Errorf("failed to unpack result: %w", err)
	}

	return isAuthorized, nil
}

// IsAuthorizedSubmitterHex 检查提交者是否被授权提交数据（使用十六进制字符串参数）
// pidHex: 项目ID的十六进制字符串 (0x前缀可选)
// submitterHex: 提交者地址的十六进制字符串 (0x前缀可选)
func (oc *OracleClient) IsAuthorizedSubmitterHex(pidHex, submitterHex string) (bool, error) {
	pid, err := HexToBytes32(pidHex)
	if err != nil {
		return false, fmt.Errorf("invalid pid: %w", err)
	}

	submitter := common.HexToAddress(submitterHex)
	return oc.IsAuthorizedSubmitter(pid, submitter)
}

// IsAuthorizedSubmitterString 检查提交者是否被授权提交数据（使用字符串参数）
// pidStr: 项目ID字符串（将转换为bytes32）
// submitterHex: 提交者地址的十六进制字符串 (0x前缀可选)
func (oc *OracleClient) IsAuthorizedSubmitterString(pidStr, submitterHex string) (bool, error) {
	pid := StringToBytes32(pidStr)
	submitter := common.HexToAddress(submitterHex)
	return oc.IsAuthorizedSubmitter(pid, submitter)
}

// StringToBytes32 将字符串转换为bytes32（左对齐）
func StringToBytes32(s string) [32]byte {
	var result [32]byte
	copy(result[:], s)
	return result
}

// HexToBytes32 将十六进制字符串转换为bytes32
// hexStr: 十六进制字符串，可以有0x前缀
func HexToBytes32(hexStr string) ([32]byte, error) {
	var result [32]byte

	// 移除0x前缀
	if strings.HasPrefix(hexStr, "0x") {
		hexStr = hexStr[2:]
	}

	// 检查长度
	if len(hexStr) != 64 {
		return result, errors.New("hex string must be 64 characters (32 bytes)")
	}

	// 转换为字节数组
	bytes, err := hex.DecodeString(hexStr)
	if err != nil {
		return result, fmt.Errorf("invalid hex string: %w", err)
	}

	copy(result[:], bytes)
	return result, nil
}

// Bytes32ToHex 将bytes32转换为十六进制字符串
func Bytes32ToHex(b [32]byte) string {
	return "0x" + hex.EncodeToString(b[:])
}

// Bytes32ToString 将bytes32转换为字符串（去除空字符）
func Bytes32ToString(b [32]byte) string {
	// 查找第一个空字符
	for i, v := range b {
		if v == 0 {
			return string(b[:i])
		}
	}
	return string(b[:])
}

// IsContractAddress 检查地址是否为合约地址
func (oc *OracleClient) IsContractAddress(address common.Address) (bool, error) {
	code, err := oc.client.CodeAt(context.Background(), address, nil)
	if err != nil {
		return false, fmt.Errorf("failed to get code: %w", err)
	}
	return len(code) > 0, nil
}

// GetChainID 获取当前链的ID
func (oc *OracleClient) GetChainID() (*big.Int, error) {
	chainID, err := oc.client.ChainID(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get chain ID: %w", err)
	}
	return chainID, nil
}

// GetLatestBlockNumber 获取最新区块号
func (oc *OracleClient) GetLatestBlockNumber() (uint64, error) {
	header, err := oc.client.HeaderByNumber(context.Background(), nil)
	if err != nil {
		return 0, fmt.Errorf("failed to get latest block: %w", err)
	}
	return header.Number.Uint64(), nil
}

// CheckContractAuthorization 检查地址是否在合约中授权
// submitterAddress: 提交者地址
// projectID: 项目ID
func CheckContractAuthorization(submitterAddress, projectID string) (bool, error) {
	rpcURL := "https://bnb-testnet.g.alchemy.com/v2/zaBnV8q3wBWZp5lp-SQ5FFhfXsfSxcnj"
	contractAddress := "0x09a0F5933f6F8129f748Da18842c3e11205a75Bf"

	if contractAddress == "0x..." {
		return true, nil
	}

	client, err := NewOracleClient(rpcURL, contractAddress)
	if err != nil {
		return false, fmt.Errorf("创建合约客户端失败: %w", err)
	}
	defer client.Close()

	return client.IsAuthorizedSubmitterString(projectID, submitterAddress)
}
