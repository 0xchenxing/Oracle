// 网络配置 - 不同网络的合约地址映射
export const NETWORK_CONFIGS = {
  // 主网 (Ethereum Mainnet)
  '1': {
    name: 'Ethereum Mainnet',
    chainId: '0x1',
    currency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    contractAddress: null
  },
  
  // Sepolia 测试网
  '11155111': {
    name: 'Sepolia Testnet',
    chainId: '0xaa36a7',
    currency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18
    },
    contractAddress: null
  },
  
  // Polygon 主网
  '137': {
    name: 'Polygon Mainnet',
    chainId: '0x89',
    currency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    contractAddress: null
  },
  
  // Polygon Mumbai 测试网
  '80001': {
    name: 'Polygon Mumbai',
    chainId: '0x13881',
    currency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    contractAddress: null
  },
  
  // BSC 主网
  '56': {
    name: 'BNB Smart Chain',
    chainId: '0x38',
    currency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18
    },
    contractAddress: null
  },
  
  // BSC Testnet
  '97': {
    name: 'BSC Testnet',
    chainId: '0x61',
    currency: {
      name: 'tBNB',
      symbol: 'BNB',
      decimals: 18
    },
    // rpcUrl: 'https://data-seed-prebsc-1-s3.bnbchain.org:8545',
    contractAddress: '0xE77EccaF51D66cE185A44d2C3c22fc7F91461A0f'
  }
};

// 获取网络配置的辅助函数
export const getNetworkConfig = (chainId) => {
  return NETWORK_CONFIGS[chainId] || null;
};

// 获取当前网络的合约地址
export const getCurrentContractAddress = (chainId) => {
  const config = getNetworkConfig(chainId);
  return config?.contractAddress || null;
};

// 检查合约地址是否已配置
export const isContractConfigured = (chainId) => {
  const address = getCurrentContractAddress(chainId);
  return address && address !== null;
};

// 获取第一个配置了合约的网络
export const getFirstConfiguredNetwork = () => {
  for (const [chainId, config] of Object.entries(NETWORK_CONFIGS)) {
    if (config.contractAddress && config.contractAddress !== null) {
      return chainId;
    }
  }
  return null;
};

// 获取配置了合约的网络列表
export const getConfiguredNetworks = () => {
  const configured = [];
  for (const [chainId, config] of Object.entries(NETWORK_CONFIGS)) {
    if (config.contractAddress && config.contractAddress !== null) {
      configured.push({ chainId, ...config });
    }
  }
  return configured;
};
