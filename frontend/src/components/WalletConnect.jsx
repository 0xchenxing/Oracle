import React, { useState, useEffect, useCallback } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';

const TOKEN_SYMBOL = 'ETH';

const CHAIN_SYMBOLS = {
  1: 'ETH',
  11155111: 'ETH',
  10: 'ETH',
  42161: 'ETH',
  8453: 'ETH',
  56: 'BNB',
  97: 'BNB',
  137: 'POL',
  80001: 'POL',
};

const WalletConnect = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [balance, setBalance] = useState(null);
  const [symbol, setSymbol] = useState(TOKEN_SYMBOL);
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!isConnected || !address) {
      setBalance(null);
      return;
    }

    setLoading(true);
    try {
      console.log('当前链ID:', chainId);
      console.log('钱包地址:', address);

      if (!publicClient) {
        console.warn('Public client 未初始化');
        setBalance(null);
        setLoading(false);
        return;
      }

      const balanceWei = await publicClient.getBalance({
        address: address,
      });

      const balanceEth = formatEther(balanceWei);
      const formattedBalance = parseFloat(balanceEth).toFixed(4);

      console.log('余额 (ETH):', formattedBalance);

      const chainSymbol = CHAIN_SYMBOLS[chainId] || TOKEN_SYMBOL;
      setBalance(formattedBalance);
      setSymbol(chainSymbol);
    } catch (error) {
      console.error('获取余额失败:', error);
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [isConnected, address, chainId, publicClient]);

  useEffect(() => {
    if (isConnected && address) {
      fetchBalance();
    }
  }, [isConnected, address, fetchBalance]);

  useEffect(() => {
    if (!isConnected || !address) return;

    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [isConnected, address, fetchBalance]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {isConnected && balance !== null && (
        <div style={{
          fontSize: '12px',
          color: '#52c41a',
          background: '#f6ffed',
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid #b7eb8f'
        }}>
          {balance} {symbol}
        </div>
      )}
      {isConnected && balance === null && !loading && (
        <div style={{
          fontSize: '12px',
          color: '#ff4d4f',
          background: '#fff2f0',
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid #ffccc7'
        }}>
          余额获取失败
        </div>
      )}
      <ConnectButton
        accountStatus="address"
        chainStatus="name"
        showBalance={false}
      />
    </div>
  );
};

export default WalletConnect;