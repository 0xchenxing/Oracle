# 钱包连接功能配置说明

## 概述

本项目已集成了RainbowKit钱包连接库，支持连接多种主流加密钱包，包括MetaMask、Coinbase Wallet、WalletConnect等。

## 获取WalletConnect Project ID

要使用钱包连接功能，您需要从WalletConnect官网获取一个Project ID：

1. 访问 [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. 创建一个新账户或登录现有账户
3. 创建一个新项目，输入项目名称和其他相关信息
4. 获取生成的Project ID

## 配置Project ID

将获取到的Project ID添加到项目根目录的`.env`文件中：

```bash
# frontend/.env
REACT_APP_WALLET_CONNECT_PROJECT_ID=YOUR_PROJECT_ID
```

如果没有`.env`文件，可以直接创建一个。

## 支持的钱包

RainbowKit默认支持以下钱包：

- MetaMask
- Coinbase Wallet
- WalletConnect (支持多种钱包应用)
- Rainbow
- Trust Wallet
- Ledger
- Argent
- Gnosis Safe
- ...等

## 功能说明

- **连接钱包**：点击页面右上角的"连接钱包"按钮选择并连接钱包
- **断开连接**：连接后，按钮会显示当前钱包地址，点击可以断开连接
- **切换网络**：支持在不同区块链网络间切换
- **查看余额**：连接后可以查看钱包余额

## 开发注意事项

1. 确保已安装所有依赖：
   ```bash
   npm install --legacy-peer-deps
   ```

2. 开发服务器启动命令：
   ```bash
   npm start
   ```

3. 构建生产版本：
   ```bash
   npm run build
   ```

4. 如果遇到依赖冲突，可以尝试使用`--legacy-peer-deps`标志安装依赖。

## 浏览器兼容性

支持所有现代浏览器（Chrome、Firefox、Safari、Edge），需要启用JavaScript。

## 故障排除

如果连接钱包时遇到问题：

1. 确保钱包扩展已安装并已登录
2. 确保浏览器允许弹出窗口
3. 检查网络连接
4. 检查控制台是否有错误信息
5. 确保已正确配置WalletConnect Project ID

## 相关文档

- [RainbowKit Documentation](https://www.rainbowkit.com/docs/introduction)
- [Wagmi Documentation](https://wagmi.sh/docs/introduction)
- [WalletConnect Documentation](https://docs.walletconnect.com/)
