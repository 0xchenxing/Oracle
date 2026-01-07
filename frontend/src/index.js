import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// 导入钱包连接库
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider, createConfig, http } from 'wagmi';
import {
  mainnet, 
  polygon, 
  optimism, 
  arbitrum, 
  base, 
  polygonMumbai, 
  sepolia,
  bsc,
  bscTestnet
} from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 创建QueryClient实例
const queryClient = new QueryClient();

// 创建Wagmi配置
const config = createConfig({
  chains: [
    mainnet,
    polygon,
    optimism,
    arbitrum,
    base,
    polygonMumbai,
    sepolia,
    bsc,  // 添加币安网
    bscTestnet  // 添加币安测试网
  ],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [polygonMumbai.id]: http(),
    [sepolia.id]: http(),
    [bsc.id]: http(),
    [bscTestnet.id]: http(),
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={bscTestnet}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();