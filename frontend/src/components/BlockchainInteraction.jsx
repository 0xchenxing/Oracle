import React from 'react';
import { Card, Button, Input, message, Space } from 'antd';
import { useAccount, useChainId, useDisconnect, useSignMessage } from 'wagmi';

const BlockchainInteraction = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { signMessage, isPending } = useSignMessage();
  const [messageToSign, setMessageToSign] = React.useState('');

  const handleSignMessage = async () => {
    if (!messageToSign.trim()) {
      message.warning('请输入要签名的消息');
      return;
    }

    try {
      const signature = await signMessage({
        message: messageToSign,
      });

      message.success('消息签名成功');
      console.log('签名结果:', signature);
    } catch (error) {
      message.error('消息签名失败');
      console.error('签名错误:', error);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    message.info('钱包已断开连接');
  };

  if (!isConnected) {
    return null;
  }

  return (
    <Card title="区块链交互示例" style={{ marginTop: 20 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <h4>账户信息</h4>
          <p>钱包地址: <code>{address}</code></p>
          <p>链ID: <code>{chainId}</code></p>
        </div>

        <div>
          <h4>消息签名</h4>
          <Input
            placeholder="请输入要签名的消息"
            value={messageToSign}
            onChange={(e) => setMessageToSign(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <Button 
            type="primary" 
            onClick={handleSignMessage}
            loading={isPending}
          >
            {isPending ? '签名中...' : '签名消息'}
          </Button>
        </div>

        <div>
          <Button 
            danger 
            onClick={handleDisconnect}
          >
            断开连接
          </Button>
        </div>
      </Space>
    </Card>
  );
};

export default BlockchainInteraction;