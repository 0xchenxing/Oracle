import React, { useState } from 'react';
import { Card, Button, Input, message, Space, Select } from 'antd';
import { useContractWrite, usePrepareContractWrite, useContractRead } from 'wagmi';
import { parseEther } from 'viem';

const { TextArea } = Input;
const { Option } = Select;

// 示例ERC20合约ABI
const erc20ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

const ContractInteraction = () => {
  const [contractAddress, setContractAddress] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [readFunction, setReadFunction] = useState('balanceOf');
  const [readResult, setReadResult] = useState(null);
  const { address } = useAccount();

  // 准备合约写操作
  const { config } = usePrepareContractWrite({
    address: contractAddress,
    abi: erc20ABI,
    functionName: 'transfer',
    args: [recipient, parseEther(amount)],
    enabled: !!contractAddress && !!recipient && !!amount,
  });

  // 执行合约写操作
  const { write, isLoading, isSuccess } = useContractWrite(config);

  // 执行合约读操作
  const { data, isLoading: isLoadingRead } = useContractRead({
    address: contractAddress,
    abi: erc20ABI,
    functionName: readFunction,
    args: readFunction === 'balanceOf' ? [address] : [],
    enabled: !!contractAddress,
  });

  const handleTransfer = () => {
    if (!write) {
      message.warning('请检查输入参数是否正确');
      return;
    }
    write();
  };

  const handleRead = () => {
    if (!contractAddress) {
      message.warning('请输入合约地址');
      return;
    }
    setReadResult(data);
  };

  React.useEffect(() => {
    if (isSuccess) {
      message.success('转账成功');
    }
  }, [isSuccess]);

  return (
    <Card title="智能合约交互" style={{ marginTop: 20 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <h4>合约配置</h4>
          <Input
            placeholder="请输入ERC20合约地址"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            style={{ marginBottom: 16 }}
          />
        </div>

        <div>
          <h4>合约读操作</h4>
          <Select
            value={readFunction}
            onChange={setReadFunction}
            style={{ width: 200, marginBottom: 16 }}
          >
            <Option value="balanceOf">balanceOf</Option>
            <Option value="totalSupply">totalSupply</Option>
          </Select>
          <Button 
            type="primary" 
            onClick={handleRead}
            loading={isLoadingRead}
          >
            读取数据
          </Button>
          {readResult && (
            <div style={{ marginTop: 16 }}>
              <h5>读取结果:</h5>
              <pre style={{ padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                {JSON.stringify(readResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div>
          <h4>合约写操作 - 转账</h4>
          <Input
            placeholder="接收方地址"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <Input
            placeholder="转账数量"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <Button 
            type="primary" 
            onClick={handleTransfer}
            loading={isLoading}
          >
            执行转账
          </Button>
        </div>
      </Space>
    </Card>
  );
};

export default ContractInteraction;