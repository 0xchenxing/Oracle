import React, { useState, useEffect } from 'react';
import { Button, Input, Form, Upload, message, Steps, Spin, Alert, Tabs, Card, Select, Table, Tag, Calendar, Modal, Tooltip, List, Empty, Divider, DatePicker, Pagination } from 'antd';
import { UploadOutlined, PlusOutlined, DeleteOutlined, SearchOutlined, DatabaseOutlined, UserOutlined, SettingOutlined, CopyOutlined, TeamOutlined, SafetyCertificateOutlined, CloudUploadOutlined, CalendarOutlined } from '@ant-design/icons';
import { useMediaQuery } from 'react-responsive';
import sha256 from 'sha256';
import axios from 'axios';
import { ethers } from 'ethers';
import dayjs from 'dayjs';
import { OracleABI } from '../contracts/OracleABI';
// 导入序列化器
import DataSerializer, { toHexString } from '../utils/dataSerializer';
// 导入Wagmi hooks
import { useAccount, useSignMessage, useContractWrite, useContractRead, usePrepareContractWrite, useSwitchChain } from 'wagmi';
// 导入网络配置
import { NETWORK_CONFIGS, getCurrentContractAddress, isContractConfigured, getFirstConfiguredNetwork, getConfiguredNetworks } from '../config/networks';

const { TextArea } = Input;

const simplifyError = (error) => {
  const message = error.message || String(error);
  
  if (message.includes('Data not found') || message.includes('execution reverted')) {
    return '未找到数据，请检查项目ID和日期是否正确';
  }
  if (message.includes('user rejected') || message.includes('User rejected')) {
    return '用户取消操作';
  }
  if (message.includes('timeout') || message.includes('Timeout')) {
    return '请求超时，请稍后重试';
  }
  if (message.includes('insufficient funds')) {
    return '余额不足，请确保钱包有足够的 Gas';
  }
  if (message.includes('nonce')) {
    return '交易序号错误，请刷新页面后重试';
  }
  if (message.includes('already submitted')) {
    return '数据已提交，不能重复上传';
  }
  if (message.includes('Unauthorized') || message.includes('not authorized')) {
    return '未授权操作，请确认是否有权限';
  }
  if (message.includes('Contract target') || message.includes('INVALID_ARGUMENT')) {
    return '合约配置错误，请检查网络配置';
  }
  
  return message.split('\n')[0].slice(0, 100);
};

const FileUploadForm = () => {
  // 响应式断点检测
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const isTablet = useMediaQuery({ minWidth: 769, maxWidth: 1024 });

  // 表单实例
  const [form] = Form.useForm();
  const [projectForm] = Form.useForm();
  const [authorizerForm] = Form.useForm(); // 添加授权人表单实例

  // 使用Wagmi hooks获取账户信息
  const { address, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  
  // 动态获取当前网络信息
  const [currentChainId, setCurrentChainId] = useState(null);
  
  // 获取当前网络ID
  useEffect(() => {
    const getCurrentChainId = async () => {
      if (window.ethereum) {
        try {
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          setCurrentChainId(parseInt(chainId, 16).toString());
        } catch (error) {
          console.error('获取网络ID失败:', error);
        }
      }
    };
    
    getCurrentChainId();
    
    // 监听网络变化
    if (window.ethereum) {
      window.ethereum.on('chainChanged', (chainId) => {
        setCurrentChainId(parseInt(chainId, 16).toString());
      });
    }
    
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('chainChanged', () => {});
      }
    };
  }, [isConnected]);
  
  // 检查当前网络是否配置了合约，如果没有则自动切换到第一个配置了合约的网络
  useEffect(() => {
    const checkAndSwitchNetwork = async () => {
      console.log('网络切换检查开始');
      console.log('isConnected:', isConnected);
      console.log('currentChainId:', currentChainId);
      
      if (isConnected && currentChainId) {
        const isContractAvailable = isContractConfigured(currentChainId);
        console.log('当前网络合约是否可用:', isContractAvailable);
        
        if (!isContractAvailable) {
          const firstConfiguredNetwork = getFirstConfiguredNetwork();
          console.log('第一个配置了合约的网络:', firstConfiguredNetwork);
          console.log('switchChain函数:', switchChain);
          
          if (firstConfiguredNetwork && switchChain) {
            const configuredChainId = parseInt(firstConfiguredNetwork, 10);
            console.log('第一个配置了合约的网络ID:', configuredChainId);
            
            // 从Wagmi的chains中动态获取对应的chain对象
            const { mainnet, polygon, optimism, arbitrum, base, polygonMumbai, sepolia, bsc, bscTestnet } = require('wagmi/chains');
            const allChains = [mainnet, polygon, optimism, arbitrum, base, polygonMumbai, sepolia, bsc, bscTestnet];
            const targetChain = allChains.find(chain => chain.id === configuredChainId);
            
            console.log('找到的目标链对象:', targetChain);
            
            if (targetChain) {
              try {
                console.log('准备调用switchChain');
                // 使用动态找到的chain对象进行切换
                await switchChain({ chainId: targetChain.id });
                message.success(`已自动切换到已配置Oracle合约的网络: ${NETWORK_CONFIGS[firstConfiguredNetwork].name}`);
                console.log('网络切换成功');
              } catch (error) {
                console.error('自动切换网络失败:', error);
                console.error('错误名称:', error.name);
                console.error('错误消息:', error.message);
                console.error('错误堆栈:', error.stack);
                message.error('自动切换网络失败，请手动切换到已配置Oracle合约的网络');
              }
            } else {
              console.error('在Wagmi的chains中找不到对应的链对象:', configuredChainId);
              message.error('自动切换网络失败，找不到对应的网络配置');
            }
          } else {
            console.log('没有配置的网络或switchChain函数不可用');
          }
        }
      }
    };
    
    checkAndSwitchNetwork();
  }, [isConnected, currentChainId, switchChain]);
  
  // 动态获取合约地址
  const contractAddress = getCurrentContractAddress(currentChainId);
  
  // 检查合约是否已配置
  const isContractAvailable = isContractConfigured(currentChainId);
  
  // 状态管理
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hashResults, setHashResults] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [txHash, setTxHash] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [dataResult, setDataResult] = useState(null);
  const [isDatePickerModalVisible, setIsDatePickerModalVisible] = useState(false); // 日期选择器模态框
  const [selectedDateForQuery, setSelectedDateForQuery] = useState(null); // 选择的查询日期
  const [projectConfig, setProjectConfig] = useState(null);
  const [coreDataResult, setCoreDataResult] = useState(null);
  const [dataHashResult, setDataHashResult] = useState(null);
  const [projectOwnerResult, setProjectOwnerResult] = useState(null);
  const [projectList, setProjectList] = useState([]); // 新增：项目列表状态
  const [isLoadingProjects, setIsLoadingProjects] = useState(false); // 新增：加载状态
  const [isContractOwner, setIsContractOwner] = useState(false); // 是否为合约所有者
  const [contractOwner, setContractOwner] = useState(''); // 合约所有者地址
  const [selectedProject, setSelectedProject] = useState(null); // 当前选中的项目
  const [activeView, setActiveView] = useState('projects'); // 当前激活的视图：projects, upload, query, register, addAuthorizer, roleManagement
  const [draftSaved, setDraftSaved] = useState(false); // 草稿保存状态

  // 新增：高级查询状态
  const [activeQueryTab, setActiveQueryTab] = useState('latest'); // 当前激活的查询页签：latest(最新数据), historical(历史数据)
  const [latestDataResult, setLatestDataResult] = useState(null); // 最新数据查询结果
  const [dataIdsResult, setDataIdsResult] = useState([]); // 数据ID列表查询结果
  const [dataIdsByPrefixResult, setDataIdsByPrefixResult] = useState([]); // 按前缀查询数据ID结果
  const [dataIdsByYearMonthResult, setDataIdsByYearMonthResult] = useState([]); // 按年月查询数据ID结果
  const [dataByYearMonthResult, setDataByYearMonthResult] = useState({}); // 按年月查询完整数据结果，按月份分组
  const [currentPage, setCurrentPage] = useState(1); // 当前页码
  const [pageSize, setPageSize] = useState(10); // 每页条数
  const [latestDataByYearMonthResult, setLatestDataByYearMonthResult] = useState(null); // 按年月查询最新数据结果
  // 日期选择器状态
  const [startYearMonth, setStartYearMonth] = useState(null); // 开始年月
  const [endYearMonth, setEndYearMonth] = useState(null); // 结束年月

  // 角色管理状态
  const [adminList, setAdminList] = useState([]); // 管理员列表
  const [dataUploaderList, setDataUploaderList] = useState([]); // 数据上传者列表
  const [isLoadingRoles, setIsLoadingRoles] = useState(false); // 角色加载状态
  const [grantRoleLoading, setGrantRoleLoading] = useState(false); // 授予角色加载状态
  const [revokeRoleLoading, setRevokeRoleLoading] = useState(false); // 撤销角色加载状态
  const [roleForm] = Form.useForm(); // 角色管理表单实例

  // 自动获取当前日期
  useEffect(() => {
    const today = new Date();
    form.setFieldsValue({ dataDate: dayjs(today) });
  }, [form]);

  // 获取合约所有者
  useEffect(() => {
    if (isConnected) {
      fetchContractOwner();
    }
  }, [isConnected]);

  // 组件初始化完成后，检查所有配置条件，确保项目列表能够及时加载
  // 监听ProjectRegistered事件获取项目列表并过滤授权项目
  useEffect(() => {
    if (isConnected && contractAddress && currentChainId) {
      fetchProjectList();
    }
  }, [isConnected, contractAddress, currentChainId, address]);

  // 获取合约所有者
  const fetchContractOwner = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, OracleABI, provider);
      
      const owner = await contract.owner();
      setContractOwner(owner);
      setIsContractOwner(owner.toLowerCase() === address.toLowerCase());
    } catch (error) {
      console.error('获取合约所有者失败:', error);
    }
  };

  // 自动查询最新数据当项目被选择或切换到最新数据页签
  useEffect(() => {
    if (selectedProject && isConnected && activeView === 'query') {
      fetchLatestDataAndId();
    }
  }, [selectedProject, isConnected, activeView]);

  // 当切换到最新数据页签时自动查询数据
  useEffect(() => {
    if (selectedProject && isConnected && activeView === 'query' && activeQueryTab === 'latest') {
      fetchLatestDataAndId();
    }
  }, [selectedProject, isConnected, activeView, activeQueryTab]);

  // 历史数据页签不再自动查询数据，改为点击查询按钮后手动查询
  // useEffect(() => {
  //   if (selectedProject && isConnected && activeView === 'query' && activeQueryTab === 'historical') {
  //     handleGetAllDataIdsAndData();
  //   }
  // }, [selectedProject, isConnected, activeView, activeQueryTab]);

  // 切换页签时只清空最新数据结果，保留历史数据查询结果
  useEffect(() => {
    // 当切换到历史数据页签时，不清空历史数据结果
    // 当切换到最新数据页签时，确保最新数据会自动刷新
  }, [activeQueryTab]);

  // 获取项目列表并过滤授权项目
  const fetchProjectList = async () => {
    const startTime = Date.now();
    console.log('[fetchProjectList] ========== 开始获取项目列表 ==========');
    console.log('[fetchProjectList] 当前链ID:', currentChainId);
    console.log('[fetchProjectList] 合约地址:', contractAddress);
    console.log('[fetchProjectList] 用户地址:', address);
    
    try {
      setIsLoadingProjects(true);
      console.log('[fetchProjectList] 步骤1: 创建Provider');
      
      // 连接到以太坊网络
      const provider = new ethers.BrowserProvider(window.ethereum);
      console.log('[fetchProjectList] Provider创建成功');
      
      // 创建合约实例
      console.log('[fetchProjectList] 步骤2: 创建合约实例');
      const contract = new ethers.Contract(contractAddress, OracleABI, provider);
      console.log('[fetchProjectList] 合约实例创建成功');
      
      let projectIds = [];
      
      // 获取所有项目，不区分用户权限
      console.log('[fetchProjectList] 步骤3: 调用getAllProjects');
      try {
        const allProjectsResult = await contract.getAllProjects();
        console.log('[fetchProjectList] getAllProjects调用成功');
        console.log('[fetchProjectList] 原始返回结果:', allProjectsResult);
        
        projectIds = allProjectsResult.projects || allProjectsResult;
        console.log('[fetchProjectList] 项目ID列表:', projectIds);
        console.log('[fetchProjectList] 项目数量:', projectIds.length);
      } catch (getAllProjectsError) {
        console.error('[fetchProjectList] getAllProjects 调用失败:', getAllProjectsError);
        console.error('[fetchProjectList] 错误名称:', getAllProjectsError.name);
        console.error('[fetchProjectList] 错误消息:', getAllProjectsError.message);
        console.error('[fetchProjectList] 错误代码:', getAllProjectsError.code);
        projectIds = [];
      }
      
      // 如果没有项目，直接返回
      if (projectIds.length === 0) {
        console.log('[fetchProjectList] 没有项目，设置空列表');
        setProjectList([]);
        message.success('项目列表获取成功！');
        setIsLoadingProjects(false);
        const elapsed = Date.now() - startTime;
        console.log(`[fetchProjectList] 完成（无项目），耗时: ${elapsed}ms`);
        return;
      }
      
      // 获取每个项目的详细信息
      console.log('[fetchProjectList] 步骤4: 获取每个项目详情，共', projectIds.length, '个项目');
      let allProjects = await Promise.all(projectIds.map(async (pidBytes32, index) => {
        console.log(`[fetchProjectList] 处理项目 ${index + 1}/${projectIds.length}:`, pidBytes32);
        try {
          // 获取项目配置
          const configResult = await contract.getProjectConfig(pidBytes32);
          console.log(`[fetchProjectList] 项目 ${pidBytes32} 配置获取成功`);
          const config = configResult.config || configResult; // 兼容不同的返回格式
          
          // 处理bytes类型的description - 修复：添加对十六进制字符串的处理
          let description = '';
          if (config.description) {
            if (typeof config.description === 'string') {
              // 检查是否是十六进制字符串
              if (config.description.startsWith('0x')) {
                // 如果是十六进制字符串，转换为UTF-8
                description = ethers.toUtf8String(config.description);
              } else {
                // 普通字符串直接使用
                description = config.description;
              }
            } else if (config.description._hex) {
              // 如果是bytes类型，转换为字符串
              description = ethers.toUtf8String(config.description);
            }
          }
          
          return {
            pid: ethers.toUtf8String(pidBytes32).slice(0, 4),
            originalPid: pidBytes32, // 保存原始的bytes32类型的pid

            description: description, // 从getProjectConfig获取描述
            dataTTL: Number(config.dataTTL),
            isActive: config.isActive
          };
        } catch (error) {
          console.error(`[fetchProjectList] 获取项目 ${pidBytes32} 信息失败:`, error);
          return null;
        }
      }));
      
      console.log('[fetchProjectList] 步骤5: 过滤null值');
      // 过滤掉null值
      allProjects = allProjects.filter(project => project !== null);
      console.log('[fetchProjectList] 有效项目数量:', allProjects.length);
      
      setProjectList(allProjects);
      console.log('[fetchProjectList] 项目列表已更新');
      
      message.success('项目列表获取成功！');
    } catch (error) {
      console.error('[fetchProjectList] 异常:', error);
      console.error('[fetchProjectList] 错误堆栈:', error.stack);
      // 提供更友好的错误提示
      if (error.message.includes('limit exceeded')) {
        message.error('获取项目列表失败：区块链数据量过大，请稍后重试或联系管理员');
      } else {
        message.error('获取项目列表失败：' + simplifyError(error));
      }
    } finally {
      setIsLoadingProjects(false);
      const elapsed = Date.now() - startTime;
      console.log(`[fetchProjectList] ========== 获取项目列表完成，耗时: ${elapsed}ms ==========`);
    }
  };

  // 获取角色列表
  const fetchRoleList = async () => {
    if (!isConnected || !contractAddress) {
      console.log('[fetchRoleList] 钱包未连接或合约未配置');
      return;
    }

    console.log('[fetchRoleList] ========== 开始获取角色列表 ==========');
    setIsLoadingRoles(true);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, OracleABI, provider);

      const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
      const DATA_UPLOADER_ROLE = await contract.DATA_UPLOADER_ROLE();

      console.log('[fetchRoleList] DEFAULT_ADMIN_ROLE:', DEFAULT_ADMIN_ROLE);
      console.log('[fetchRoleList] DATA_UPLOADER_ROLE:', DATA_UPLOADER_ROLE);

      let admins = [];
      let dataUploaders = [];

      try {
        const adminFilter = contract.filters.RoleGranted(DEFAULT_ADMIN_ROLE, null, null);
        const adminEvents = await contract.queryFilter(adminFilter, 0, 'latest');
        admins = [...new Set(adminEvents.map(e => e.args.account.toLowerCase()))];
        console.log('[fetchRoleList] 管理员地址列表:', admins);
      } catch (error) {
        console.error('[fetchRoleList] 获取管理员事件失败:', error);
      }

      try {
        const uploaderFilter = contract.filters.RoleGranted(DATA_UPLOADER_ROLE, null, null);
        const uploaderEvents = await contract.queryFilter(uploaderFilter, 0, 'latest');
        dataUploaders = [...new Set(uploaderEvents.map(e => e.args.account.toLowerCase()))];
        console.log('[fetchRoleList] 数据上传者地址列表:', dataUploaders);
      } catch (error) {
        console.error('[fetchRoleList] 获取数据上传者事件失败:', error);
      }

      setAdminList(admins);
      setDataUploaderList(dataUploaders);

      console.log('[fetchRoleList] 角色列表获取成功');
    } catch (error) {
      console.error('[fetchRoleList] 获取角色列表失败:', error);
    } finally {
      setIsLoadingRoles(false);
      console.log('[fetchRoleList] ========== 获取角色列表完成 ==========');
    }
  };

  const fetchLatestDataAndId = async () => {
    if (!selectedProject || !selectedProject.originalPid) {
      throw new Error('未选择项目');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(contractAddress, OracleABI, provider);

    const [data, did] = await Promise.all([
      contract.getLatestData(selectedProject.originalPid),
      contract.getLatestDataId(selectedProject.originalPid)
    ]);

    // 确保coreData被转换为正确的格式（Uint8Array或十六进制字符串）
    let coreData;
    if (typeof data.coreData === 'string') {
      // 如果已经是字符串，直接使用
      coreData = data.coreData;
    } else if (data.coreData?.toHexString) {
      // 如果是ethers.js的Bytes对象，转换为十六进制字符串
      coreData = data.coreData.toHexString();
    } else if (data.coreData instanceof Uint8Array) {
      // 如果已经是Uint8Array，直接使用
      coreData = data.coreData;
    } else {
      // 其他情况，尝试转换为十六进制字符串
      coreData = JSON.stringify(data.coreData);
      console.error(`不支持的coreData类型: ${typeof data.coreData}`);
    }
    
    const latestData = {
      pid: data.pid,
      did: data.did,
      coreData: coreData,
      dataHash: data.dataHash,
      submitter: data.submitter,
      submitTime: new Date(Number(data.submitTime) * 1000).toISOString()
    };

    setLatestDataResult(latestData);
  };

  const fetchAllDataIdsAndData = async () => {
    if (!selectedProject || !selectedProject.originalPid) {
      throw new Error('未选择项目');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(contractAddress, OracleABI, provider);

    const dids = await contract.getDataIds(selectedProject.originalPid);
    setDataIdsResult(dids);

    if (dids.length > 0) {
      const latestDid = dids[dids.length - 1];
      const data = await contract.getData(selectedProject.originalPid, latestDid);

      // 确保coreData被转换为正确的格式（Uint8Array或十六进制字符串）
      let coreData;
      if (typeof data.coreData === 'string') {
        // 如果已经是字符串，直接使用
        coreData = data.coreData;
      } else if (data.coreData?.toHexString) {
        // 如果是ethers.js的Bytes对象，转换为十六进制字符串
        coreData = data.coreData.toHexString();
      } else if (data.coreData instanceof Uint8Array) {
        // 如果已经是Uint8Array，直接使用
        coreData = data.coreData;
      } else {
        // 其他情况，尝试转换为十六进制字符串
        coreData = JSON.stringify(data.coreData);
        console.error(`不支持的coreData类型: ${typeof data.coreData}`);
      }

      setLatestDataResult({
        pid: data.pid,
        did: data.did,
        coreData: coreData,
        dataHash: data.dataHash,
        submitter: data.submitter,
        submitTime: new Date(Number(data.submitTime) * 1000).toISOString()
      });
    }
  };

  // 授予角色
  const handleGrantRole = async (values) => {
    const { roleType, address: accountAddress } = values;

    if (!isConnected) {
      message.error('请先连接钱包');
      return;
    }

    if (!contractAddress) {
      message.error('合约地址未配置');
      return;
    }

    console.log('[handleGrantRole] 准备授予角色:', roleType, '给地址:', accountAddress);

    try {
      setGrantRoleLoading(true);
      message.loading('正在授予角色...', 0);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, OracleABI, signer);

      let roleBytes32;
      if (roleType === 'admin') {
        roleBytes32 = await contract.DEFAULT_ADMIN_ROLE();
      } else if (roleType === 'dataUploader') {
        roleBytes32 = await contract.DATA_UPLOADER_ROLE();
      } else {
        throw new Error('未知的角色类型');
      }

      console.log('[handleGrantRole] 角色bytes32:', roleBytes32);

      const tx = await contract.grantRole(roleBytes32, accountAddress);
      console.log('[handleGrantRole] 交易已提交:', tx.hash);

      message.destroy();
      message.success('角色授予交易已发送，等待确认...');

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        message.success('角色授予成功！');
        roleForm.resetFields();
        await fetchRoleList();
      } else {
        message.error('角色授予失败！');
      }
    } catch (error) {
      console.error('[handleGrantRole] 授予角色失败:', error);
      message.destroy();
      message.error('角色授予失败：' + simplifyError(error));
    } finally {
      setGrantRoleLoading(false);
    }
  };

  // 撤销角色
  const handleRevokeRole = async (values) => {
    const { roleType, address: accountAddress } = values;

    if (!isConnected) {
      message.error('请先连接钱包');
      return;
    }

    if (!contractAddress) {
      message.error('合约地址未配置');
      return;
    }

    console.log('[handleRevokeRole] 准备撤销角色:', roleType, '从地址:', accountAddress);

    try {
      setRevokeRoleLoading(true);
      message.loading('正在撤销角色...', 0);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, OracleABI, signer);

      let roleBytes32;
      if (roleType === 'admin') {
        roleBytes32 = await contract.DEFAULT_ADMIN_ROLE();
      } else if (roleType === 'dataUploader') {
        roleBytes32 = await contract.DATA_UPLOADER_ROLE();
      } else {
        throw new Error('未知的角色类型');
      }

      console.log('[handleRevokeRole] 角色bytes32:', roleBytes32);

      const tx = await contract.revokeRole(roleBytes32, accountAddress);
      console.log('[handleRevokeRole] 交易已提交:', tx.hash);

      message.destroy();
      message.success('角色撤销交易已发送，等待确认...');

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        message.success('角色撤销成功！');
        await fetchRoleList();
      } else {
        message.error('角色撤销失败！');
      }
    } catch (error) {
      console.error('[handleRevokeRole] 撤销角色失败:', error);
      message.destroy();
      message.error('角色撤销失败：' + simplifyError(error));
    } finally {
      setRevokeRoleLoading(false);
    }
  };

  // 直接撤销角色（从列表点击）
  const directRevokeRole = async (roleType, accountAddress) => {
    if (!isConnected) {
      message.error('请先连接钱包');
      return;
    }

    if (!contractAddress) {
      message.error('合约地址未配置');
      return;
    }

    console.log('[directRevokeRole] 准备撤销角色:', roleType, '从地址:', accountAddress);

    try {
      setRevokeRoleLoading(true);
      message.loading('正在撤销角色...', 0);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, OracleABI, signer);

      let roleBytes32;
      if (roleType === 'admin') {
        roleBytes32 = await contract.DEFAULT_ADMIN_ROLE();
      } else if (roleType === 'dataUploader') {
        roleBytes32 = await contract.DATA_UPLOADER_ROLE();
      } else {
        throw new Error('未知的角色类型');
      }

      console.log('[directRevokeRole] 角色bytes32:', roleBytes32);

      const tx = await contract.revokeRole(roleBytes32, accountAddress);
      console.log('[directRevokeRole] 交易已提交:', tx.hash);

      message.destroy();
      message.success('角色撤销交易已发送，等待确认...');

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        message.success('角色撤销成功！');
        await fetchRoleList();
      } else {
        message.error('角色撤销失败！');
      }
    } catch (error) {
      console.error('[directRevokeRole] 撤销角色失败:', error);
      message.destroy();
      message.error('角色撤销失败：' + simplifyError(error));
    } finally {
      setRevokeRoleLoading(false);
    }
  };

  // 步骤定义
  const steps = [
    { title: '计算哈希', description: '计算所有文件的哈希值' },
    { title: '钱包签名', description: '对数据进行钱包签名' },
    { title: '提交到后台', description: '将文件和签名数据上传到服务器' },
    { title: '提交到合约', description: '将数据和哈希存储到区块链' },
  ];

  // 文件选择处理
  const handleFileChange = ({ fileList }) => {
    console.log('handleFileChange - fileList:', fileList);
    
    // 处理文件列表，确保每个文件都有originFileObj
    const processedFileList = fileList.map(file => {
      console.log('handleFileChange - file:', file);
      console.log('handleFileChange - file.originFileObj:', file.originFileObj);
      console.log('handleFileChange - file.response:', file.response);
      
      // 如果没有originFileObj但有response，尝试从response中获取
      if (!file.originFileObj && file.response) {
        console.log('handleFileChange - Using file.response as originFileObj');
        return { ...file, originFileObj: file.response };
      }
      
      // 如果文件状态是done但没有originFileObj，可能需要特殊处理
      if (file.status === 'done' && !file.originFileObj) {
        console.log('handleFileChange - File is done but missing originFileObj');
      }
      
      return file;
    });
    
    setSelectedFiles(processedFileList);
  };

  // 保存草稿到 localStorage
  const handleSaveDraft = async () => {
    try {
      const formValues = form.getFieldsValue();
      
      // 保存核心数据字段
      const coreDataFields = form.getFieldValue('coreData') || [];
      
      const draftData = {
        projectId: formValues.projectId,
        dataDate: formValues.dataDate ? formValues.dataDate.format('YYYY-MM-DD') : null,
        coreData: coreDataFields,
        savedAt: new Date().toISOString(),
      };
      
      localStorage.setItem('oracleUploadDraft', JSON.stringify(draftData));
      setDraftSaved(true);
      message.success('草稿已保存');
      
      // 3秒后清除保存状态提示
      setTimeout(() => setDraftSaved(false), 3000);
    } catch (error) {
      console.error('保存草稿失败:', error);
      message.error('保存草稿失败');
    }
  };

  // 从 localStorage 加载草稿
  const loadDraft = () => {
    try {
      const draftJson = localStorage.getItem('oracleUploadDraft');
      if (draftJson) {
        const draftData = JSON.parse(draftJson);
        
        // 恢复表单数据
        if (draftData.dataDate) {
          form.setFieldsValue({ dataDate: dayjs(draftData.dataDate) });
        }
        
        if (draftData.coreData) {
          form.setFieldsValue({ coreData: draftData.coreData });
        }
        
        message.info('已加载上次保存的草稿');
        return true;
      }
      return false;
    } catch (error) {
      console.error('加载草稿失败:', error);
      return false;
    }
  };

  // 组件挂载时加载草稿
  useEffect(() => {
    if (activeView === 'upload') {
      loadDraft();
    }
  }, [activeView]);

  // 计算文件哈希
  const calculateFileHash = (file) => {
    return new Promise((resolve, reject) => {
      console.log('calculateFileHash - file:', file);
      console.log('calculateFileHash - file.originFileObj:', file.originFileObj);
      console.log('calculateFileHash - file.raw:', file.raw);
      
      // 使用raw属性获取原始文件对象（Ant Design Upload组件的标准属性）
      const fileObj = file.raw || file.originFileObj;
      
      if (!fileObj) {
        console.error('calculateFileHash - Missing file object');
        reject(new Error('文件对象缺少raw或originFileObj属性'));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        // 将ArrayBuffer转换为Uint8Array后再计算哈希
        const arrayBuffer = e.target.result;
        const uint8Array = new Uint8Array(arrayBuffer);
        const hash = sha256(uint8Array);
        console.log('calculateFileHash - arrayBuffer:', arrayBuffer);
        console.log('calculateFileHash - uint8Array:', uint8Array);
        console.log('calculateFileHash - hash result:', hash);
        resolve({ fileName: file.name, fileSize: file.size, hashValue: hash });
      };
      reader.onerror = (error) => {
        console.error('calculateFileHash - FileReader error:', error);
        reject(error);
      };
      reader.readAsArrayBuffer(fileObj);
    });
  };

  // 一键上传数据主流程
  const handleUpload = async () => {
    try {
      // 表单验证
      await form.validateFields();
      
      if (selectedFiles.length === 0) {
        message.error('请至少选择一个文件');
        return;
      }

      setIsProcessing(true);
      setCurrentStep(0);
      setTxHash('');
      setTxStatus('');

      // 1. 计算哈希
      message.info('开始计算文件哈希...');
      console.log('handleUpload - selectedFiles:', selectedFiles);
      console.log('handleUpload - selectedFiles.length:', selectedFiles.length);
      const hashPromises = selectedFiles.map(file => calculateFileHash(file));
      console.log('handleUpload - hashPromises:', hashPromises);
      console.log('handleUpload - hashPromises.length:', hashPromises.length);
      const hashResults = await Promise.all(hashPromises);
      console.log('handleUpload - hashResults:', hashResults);
      console.log('handleUpload - hashResults.length:', hashResults.length);
      setHashResults(hashResults);
      message.success('哈希计算完成');
      setCurrentStep(1);

       // 2. 构造待签名数据
      message.info('正在生成签名数据...');
      
      // 获取所有需要签名的数据
      const projectId = form.getFieldValue('projectId');
      const dataDate = form.getFieldValue('dataDate');
      
      // 构建待签名消息
      const signatureData = {
        projectId: projectId,
        dataDate: dataDate,
        coreDataHash: '', // 需要计算核心数据的哈希
        fileHashes: hashResults.map(h => h.hashValue),
        timestamp: Date.now(),
      };
      
      // 计算核心数据的哈希
      const formCoreData = form.getFieldValue('coreData') || [];
      const coreDataObj = {};
      formCoreData.forEach((field) => {
        if (field.key && field.value) {
          coreDataObj[field.key] = field.value;
        }
      });
      const serializedCoreData = DataSerializer.serialize(coreDataObj);
      const coreDataHash = ethers.keccak256(serializedCoreData);
      signatureData.coreDataHash = coreDataHash;
      
      // 将签名数据转换为字符串
      const signatureMessage = JSON.stringify(signatureData);
      
      // 3. 使用钱包签名
      message.info('请确认钱包签名...');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(signatureMessage);
      
      // 4. 提交到后台（包含签名数据）
      message.info('开始提交到后台...');
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file.raw || file.originFileObj);
      });
      
      // 获取当前选中的项目ID和项目描述
      const selectedProject = projectList.find(p => p.pid === projectId);
      const projectDescription = selectedProject ? selectedProject.description : '';
      
      formData.append('projectId', projectId);
      formData.append('projectDescription', projectDescription);
      formData.append('dataDate', dataDate);
      formData.append('coreData', JSON.stringify(Array.from(serializedCoreData)));
      formData.append('hashResults', JSON.stringify(hashResults));
      
      // 添加签名数据
      formData.append('signatureData', signatureMessage);
      formData.append('signature', signature);
      
      await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log('上传进度:', percentCompleted);
        }
      });

      message.success('后台上传成功');
      setCurrentStep(3);

      // 5. 提交到合约
      message.info('开始提交到智能合约...');
      await submitToContract(hashResults);
      
      message.success('合约提交成功');
      setCurrentStep(4);
      
      setIsProcessing(false);
      message.success('所有操作完成！');
    } catch (error) {
      setIsProcessing(false);
      console.error('上传失败:', error);
      console.error('错误详情:', error.config);
      message.error('上传失败：' + simplifyError(error));
      if (error.response) {
        console.error('响应数据:', error.response.data);
        console.error('响应状态:', error.response.status);
      } else if (error.request) {
        console.error('请求未收到响应:', error.request);
      }
    }
  };

  // 提交到智能合约 - 使用Wagmi hooks
  const submitToContract = async (providedHashResults) => {
    try {
      // 检查钱包连接状态
      if (!isConnected) {
        message.error('请先连接钱包');
        throw new Error('钱包未连接');
      }
      
      // 获取表单数据
      const projectId = form.getFieldValue('projectId');
      const dataDate = form.getFieldValue('dataDate');
      
      // 从form中获取核心数据
      const formCoreData = form.getFieldValue('coreData') || [];
      
      // 将核心数据转换为键值对对象，使用用户输入的键名
      const coreDataObj = {};
      formCoreData.forEach((field) => {
        if (field.key && field.value) {
          coreDataObj[field.key] = field.value;
        }
      });
      
      // 使用新的序列化器
      const serializedCoreData = DataSerializer.serialize(coreDataObj);
      console.log('序列化后的数据:', serializedCoreData);
      console.log('Hex格式:', toHexString(serializedCoreData));
      
      // 使用传递的哈希结果，如果没有则使用状态变量
      const hashResultsToUse = providedHashResults || hashResults;
      
      // 调试：检查表单数据
      console.log('submitToContract - projectId:', projectId);
      console.log('submitToContract - dataDate:', dataDate);
      console.log('submitToContract - providedHashResults:', providedHashResults);
      console.log('submitToContract - hashResults (state):', hashResults);
      console.log('submitToContract - hashResultsToUse:', hashResultsToUse);
      console.log('submitToContract - hashResultsToUse.length:', hashResultsToUse?.length);
      
      // 验证表单数据
      if (!projectId) {
        throw new Error('项目ID不能为空');
      }
      if (!dataDate) {
        throw new Error('数据日期不能为空');
      }
      if (!serializedCoreData || serializedCoreData.length === 0) {
        throw new Error('核心数据不能为空');
      }
      if (!hashResultsToUse || hashResultsToUse.length === 0) {
        throw new Error('哈希结果不能为空');
      }
      
      // 计算DID（使用合约的encodeYearMonthDayToDid函数）
      // 处理 dayjs 对象或字符串格式的日期
      const dataDateStr = dayjs.isDayjs(dataDate) ? dataDate.format('YYYY-MM-DD') : dataDate;
      const [year, month, day] = dataDateStr.split('-');
      
      // 调试：检查日期拆分结果
      console.log('submitToContract - date parts:', year, month, day);
      
      // 验证日期拆分结果
      if (!year || !month || !day) {
        throw new Error('数据日期格式错误，无法正确拆分年、月、日');
      }
      
      // 转换为数字类型
      const yearNum = parseInt(year, 10);
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);
      
      // 连接到以太坊网络
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      // 使用只读合约获取DID
      const readOnlyContract = new ethers.Contract(contractAddress, OracleABI, provider);
      
      // 使用合约的encodeYearMonthDayToDid函数生成DID
      const did = await readOnlyContract.encodeYearMonthDayToDid(yearNum, monthNum, dayNum);
      
      // 调试：检查DID计算过程
      console.log('submitToContract - did:', did);
      
      // 验证DID结果
      if (!did || did === '0x' || did === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        throw new Error('DID计算错误，结果为空或无效');
      }

      // 复用之前的provider
      const signer = await provider.getSigner();
      
      // 合约地址（已在组件顶部全局配置）
      const contract = new ethers.Contract(contractAddress, OracleABI, signer);
      
      // 处理数据哈希 - 确保转换为正确的bytes32格式
      let dataHashBytes32;
      if (hashResultsToUse.length === 1) {
        // 单个哈希的情况
        const singleHash = hashResultsToUse[0].hashValue;
        console.log('submitToContract - 单个哈希值:', singleHash);
        console.log('submitToContract - 单个哈希长度:', singleHash.length);
        
        // 确保哈希值是64字符的十六进制字符串，没有0x前缀
        let cleanHash = singleHash;
        if (cleanHash.startsWith('0x')) {
          cleanHash = cleanHash.slice(2);
        }
        
        // 如果哈希长度不足64字符，用0填充到64字符
        if (cleanHash.length < 64) {
          cleanHash = cleanHash.padStart(64, '0');
        }
        // 如果哈希长度超过64字符，截取前64字符
        if (cleanHash.length > 64) {
          cleanHash = cleanHash.substring(0, 64);
        }
        
        // 添加0x前缀形成有效的bytes32格式
        dataHashBytes32 = '0x' + cleanHash;
        console.log('submitToContract - bytes32格式哈希:', dataHashBytes32);
        console.log('submitToContract - bytes32长度:', dataHashBytes32.length);
      } else {
        // 多个哈希的情况：对拼接后的字符串进行keccak256哈希以获得32字节的结果
        console.log('submitToContract - 多个哈希情况，使用keccak256处理');
        const hashesString = hashResultsToUse.map(h => h.hashValue).join(',');
        console.log('submitToContract - 拼接后的哈希字符串:', hashesString);
        console.log('submitToContract - 拼接后的哈希字符串长度:', hashesString.length);
        dataHashBytes32 = ethers.keccak256(ethers.toUtf8Bytes(hashesString));
      }
      
      // 调试：检查合约调用参数
      console.log('submitToContract - contract parameters:');
      console.log('  projectId (encoded):', ethers.encodeBytes32String(projectId));
      console.log('  did:', did);
      console.log('  serializedCoreData (bytes):', serializedCoreData);
      console.log('  serializedCoreData (hex):', toHexString(serializedCoreData));
      console.log('  dataHashBytes32:', dataHashBytes32);
      
      // 执行合约交易
      console.log('submitToContract - 执行合约交易:', {
        projectId: projectId,
        encodedProjectId: ethers.encodeBytes32String(projectId),
        did: did,
        serializedCoreData: serializedCoreData,
        serializedCoreDataHex: toHexString(serializedCoreData),
        dataHashBytes32: dataHashBytes32
      });
      
      const tx = await contract.submitData(
        ethers.encodeBytes32String(projectId), // 将projectId转换为bytes32
        did, // 使用合约生成的DID
        serializedCoreData, // 使用序列化后的二进制数据
        dataHashBytes32 // 使用正确格式的bytes32哈希
      );

      setTxHash(tx.hash);
      setTxStatus('交易已发送，等待确认...');

      // 等待交易确认
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        setTxStatus('交易已确认！');
        message.success('合约提交成功');
      } else {
        setTxStatus('交易失败');
        throw new Error('交易执行失败');
      }
    } catch (error) {
      console.error('合约提交失败:', error);
      message.error('合约提交失败：' + simplifyError(error));
      throw error;
    }
  };

  // Oracle操作：项目注册
  const handleRegisterProject = async (values) => {
    try {
      message.loading('正在注册项目...', 0);
      setIsProcessing(true);

      // 检查钱包连接状态
      if (!isConnected) {
        message.error('请先连接钱包');
        throw new Error('钱包未连接');
      }

      // 连接到以太坊网络
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // 合约地址（已在组件顶部全局配置）
      const contract = new ethers.Contract(contractAddress, OracleABI, signer);

      // 获取表单数据
      const { projectId, description, dataTTLValue, dataTTLUnit } = values;
      
      // 时间单位转换为秒
      let dataTTLInSeconds;
      const value = parseInt(dataTTLValue, 10);
      
      switch (dataTTLUnit) {
        case 'seconds':
          dataTTLInSeconds = value;
          break;
        case 'minutes':
          dataTTLInSeconds = value * 60;
          break;
        case 'hours':
          dataTTLInSeconds = value * 60 * 60;
          break;
        case 'days':
          dataTTLInSeconds = value * 60 * 60 * 24;
          break;
        case 'weeks':
          dataTTLInSeconds = value * 60 * 60 * 24 * 7;
          break;
        case 'months':
          dataTTLInSeconds = value * 60 * 60 * 24 * 30; // 简化为30天
          break;
        case 'years':
          dataTTLInSeconds = value * 60 * 60 * 24 * 365; // 简化为365天
          break;
        default:
          dataTTLInSeconds = value;
      }
      
      // 执行合约交易
      const tx = await contract.registerProject(
        ethers.encodeBytes32String(projectId), // 将字符串转换为bytes32
        description,
        ethers.toBigInt(dataTTLInSeconds) // 使用ethers.toBigInt方法
      );
      console.log('Transaction submitted:', tx.hash);
  
      message.destroy();
      message.success('项目注册交易已发送，等待确认...');
      
      // 等待交易确认
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        message.success('项目注册成功！');
        projectForm.resetFields();
        // 刷新项目列表
        fetchProjectList();
      } else {
        message.error('项目注册失败！');
        throw new Error('交易执行失败');
      }
    } catch (error) {
      console.error('项目注册失败:', error);
      message.destroy();
      message.error('项目注册失败：' + simplifyError(error));
    } finally {
      setIsProcessing(false);
    }
  };


  // Oracle操作：添加授权人
  const handleAddAuthorizer = async (values) => {
    try {
      message.loading('正在添加授权人...', 0);
      setIsProcessing(true);
  
      // 检查钱包连接状态
      if (!isConnected) {
        message.error('请先连接钱包');
        throw new Error('钱包未连接');
      }
      
      // 连接到以太坊网络
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // 合约地址（已在组件顶部全局配置）
      const contract = new ethers.Contract(contractAddress, OracleABI, signer);
  
      // 执行合约调用
      const tx = await contract.addAuthorizedSubmitter(
        ethers.encodeBytes32String(values.projectId), // 统一使用encodeBytes32String转换
        values.submitterAddress
      );
  
      // 等待交易确认
      await tx.wait();
  
      message.destroy();
      message.success('授权人添加成功！');
      
      // 重置表单
      authorizerForm.resetFields();
    } catch (error) {
      console.error('添加授权人失败:', error);
      message.destroy();
      message.error('添加授权人失败：' + simplifyError(error));
    } finally {
      setIsProcessing(false);
    }
  };

  // 新增：项目列表列配置
  const projectColumns = [
    {
      title: '项目ID',
      dataIndex: 'pid',
      key: 'pid',
      render: (text) => <a>{text}</a>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '数据有效期',
      dataIndex: 'dataTTL',
      key: 'dataTTL',
      render: (text) => {
        // 转换TTL为可读格式
        if (text < 60) {
          return `${text} 秒`;
        } else if (text < 3600) {
          return `${Math.floor(text / 60)} 分钟`;
        } else if (text < 86400) {
          return `${Math.floor(text / 3600)} 小时`;
        } else {
          return `${Math.floor(text / 86400)} 天`;
        }
      },
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '激活' : '禁用'}
        </Tag>
      ),
    },

    {
      title: '数据上传',
      key: 'upload',
      render: (_, record) => (
        <Button 
          type="link" 
          onClick={() => handleProjectUpload(record)} 
          icon={<UploadOutlined />}
        >
          上传
        </Button>
      ),
    },
    {
      title: '数据查询',
      key: 'query',
      render: (_, record) => (
        <Button 
          type="link" 
          onClick={() => handleProjectQuery(record)} 
          icon={<SearchOutlined />}
        >
          查询
        </Button>
      ),
    },
    {
      title: '添加授权人',
      key: 'addAuthorizer',
      render: (_, record) => (
        <Button 
          type="link" 
          onClick={() => handleAddAuthorizerForProject(record)}
          icon={<UserOutlined />}
        >
          授权
        </Button>
      ),
    },
  ];

  // 处理项目点击上传
  const handleProjectUpload = (project) => {
    setSelectedProject(project);
    setActiveView('upload');
    // 自动填充项目ID到上传表单
    form.setFieldValue('projectId', project.pid);
  };

  // 处理项目点击查询
  const handleProjectQuery = (project) => {
    setSelectedProject(project);
    setActiveView('query');
  };

  // 处理为项目添加授权人
  const handleAddAuthorizerForProject = (project) => {
    setSelectedProject(project);
    setActiveView('addAuthorizer');
    // 自动填充项目ID到授权人表单
    authorizerForm.setFieldValue('projectId', project.pid);
  };

  const [isQuerying, setIsQuerying] = useState(false); // 防止重复查询
  const [pendingQuery, setPendingQuery] = useState(null); // 待处理的查询请求

  // 处理日历日期选择
  const handleDateSelect = async (date) => {
    // 防止重复点击
    if (isQuerying) {
      message.warning('查询进行中，请稍候...');
      return;
    }

    // 检查钱包连接状态
    if (!isConnected) {
      message.error('请先连接钱包');
      return;
    }

    // 检查是否选择了项目
    if (!selectedProject) {
      message.error('请先选择项目');
      return;
    }

    const dataDate = date.format('YYYY-MM-DD');
    const projectId = selectedProject.pid;

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 30000); // 30秒超时

    // 清空年月范围查询结果
    setDataIdsByYearMonthResult([]);
    setPendingQuery({ dataDate, projectId });
    setIsQuerying(true);
    message.loading('正在查询数据...', 0);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, OracleABI, provider);

      const dataDateStr = dayjs.isDayjs(dataDate) ? dataDate.format('YYYY-MM-DD') : dataDate;
      const [year, month, day] = dataDateStr.split('-');
      const yearNum = parseInt(year, 10);
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);

      const did = await contract.encodeYearMonthDayToDid(yearNum, monthNum, dayNum, { signal: abortController.signal });

      const data = await contract.getData(
        ethers.encodeBytes32String(projectId),
        did,
        { signal: abortController.signal }
      );

      clearTimeout(timeoutId);
      message.destroy();
      message.success('数据查询成功！');

      // 确保coreData被转换为正确的格式（Uint8Array或十六进制字符串）
      let coreData;
      if (typeof data.coreData === 'string') {
        // 如果已经是字符串，直接使用
        coreData = data.coreData;
      } else if (data.coreData?.toHexString) {
        // 如果是ethers.js的Bytes对象，转换为十六进制字符串
        coreData = data.coreData.toHexString();
      } else if (data.coreData instanceof Uint8Array) {
        // 如果已经是Uint8Array，直接使用
        coreData = data.coreData;
      } else {
        // 其他情况，尝试转换为十六进制字符串
        coreData = JSON.stringify(data.coreData);
        console.error(`不支持的coreData类型: ${typeof data.coreData}`);
      }

      setDataResult({
        pid: data.pid,
        did: data.did,
        coreData: coreData,
        dataHash: data.dataHash,
        submitter: data.submitter,
        submitTime: new Date(Number(data.submitTime) * 1000).toISOString()
      });
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('数据查询失败:', error);
      message.destroy();

      if (error.name === 'AbortError') {
        message.error('查询超时，请稍后重试');
      } else if (error.message && error.message.includes('user rejected')) {
        message.warning('用户取消操作');
      } else {
        message.error('数据查询失败：' + simplifyError(error));
      }
    } finally {
      setIsQuerying(false);
      setPendingQuery(null);
    }
  };

  // 返回项目列表
  const handleBackToProjects = () => {
    setActiveView('projects');
    setSelectedProject(null);
  };


  // 按钮处理器：获取所有数据ID和所有数据
  const handleGetAllDataIdsAndData = async () => {
    if (!selectedProject) {
      message.error('请先选择项目');
      return;
    }
    if (!isConnected) {
      message.error('请先连接钱包');
      return;
    }
    setIsProcessing(true);
    try {
      await fetchAllDataIdsAndData();
      message.success('全部数据查询成功');
    } catch (error) {
      message.error('查询失败：' + simplifyError(error));
    } finally {
      setIsProcessing(false);
    }
  };

  // 按年月获取完整数据列表
  const fetchDataByYearMonth = async (year, month) => {
    if (!selectedProject || !isConnected) {
      return [];
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, OracleABI, provider);
      const projectId = ethers.encodeBytes32String(selectedProject.pid);

      const dataIds = await contract.getDataIdsByYearMonth(projectId, year, month);
      
      // 获取每个数据ID对应的完整数据
      const dataList = await Promise.all(dataIds.map(async (dataId) => {
        try {
          const data = await contract.getData(projectId, dataId);
          
          // 确保coreData被转换为正确的格式（Uint8Array或十六进制字符串）
          let coreData;
          console.log('原始coreData类型:', typeof data.coreData);
          console.log('原始coreData:', data.coreData);
          
          if (data.coreData === null || data.coreData === undefined) {
            // 如果是null或undefined，使用空字符串
            console.log('coreData是null或undefined，使用空字符串');
            coreData = '';
          } else if (typeof data.coreData === 'string') {
            // 如果已经是字符串，直接使用
            console.log('coreData是字符串，直接使用');
            coreData = data.coreData;
          } else if (data.coreData?.toHexString) {
            // 如果是ethers.js的Bytes对象，转换为十六进制字符串
            console.log('coreData是ethers.js Bytes对象，转换为十六进制字符串');
            coreData = data.coreData.toHexString();
            console.log('转换后的coreData:', coreData);
          } else if (data.coreData instanceof Uint8Array) {
            // 如果已经是Uint8Array，直接使用
            console.log('coreData是Uint8Array，直接使用');
            coreData = data.coreData;
          } else {
            // 其他情况，尝试转换为十六进制字符串
            console.error(`不支持的coreData类型: ${typeof data.coreData}`);
            coreData = JSON.stringify(data.coreData);
          }
          
          return {
            pid: data.pid,
            coreData: coreData,
            dataHash: data.dataHash,
            submitter: data.submitter,
            submitTime: new Date(Number(data.submitTime) * 1000).toISOString(),
            did: dataId,
            originalDid: dataId
          };
        } catch (error) {
          console.error(`获取数据ID ${dataId} 的完整数据失败:`, error);
          return null;
        }
      }));
      
      // 过滤掉获取失败的数据
      return dataList.filter(Boolean);
    } catch (error) {
      console.error('按年月获取数据失败:', error);
      throw error;
    }
  };

  // 按钮处理器：按年月范围查询
  const handleGetDataByYearMonthRange = async () => {
    if (!startYearMonth || !endYearMonth) {
      message.warning('请选择开始年月和结束年月');
      return;
    }
    
    const startDateStr = startYearMonth.format('YYYY-MM');
    const endDateStr = endYearMonth.format('YYYY-MM');
    
    const [startYear, startMonth] = startDateStr.split('-').map(Number);
    const [endYear, endMonth] = endDateStr.split('-').map(Number);
    
    if (!selectedProject) {
      message.error('请先选择项目');
      return;
    }
    
    if (!isConnected) {
      message.error('请先连接钱包');
      return;
    }
    
    setIsProcessing(true);
    try {
      // 清空日期查询结果和当前页码
      setDataResult(null);
      setCurrentPage(1);
      
      // 遍历开始年月到结束年月之间的所有年月
      const dataByMonth = {};
      let totalDataCount = 0;
      let currentYear = startYear;
      let currentMonth = startMonth;
      
      while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        const dataList = await fetchDataByYearMonth(currentYear, currentMonth);
        
        if (dataList.length > 0) {
          dataByMonth[monthKey] = dataList;
          totalDataCount += dataList.length;
        }
        
        // 移动到下一个月
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }
      
      // 更新数据ID列表和完整数据结果
      setDataIdsByYearMonthResult(Object.values(dataByMonth).flat().map(data => data.did));
      setDataByYearMonthResult(dataByMonth);
      
      message.success(`查询成功，共找到 ${totalDataCount} 条数据，分布在 ${Object.keys(dataByMonth).length} 个月份中`);
    } catch (error) {
      message.error('查询失败：' + simplifyError(error));
    } finally {
      setIsProcessing(false);
    }
  };

  // 响应式容器样式
  const containerStyle = {
    maxWidth: isMobile ? '100%' : '1200px',
    margin: '0 auto',
    padding: isMobile ? '12px' : '20px',
  };

  // 响应式标题样式
  const titleStyle = {
    textAlign: 'center',
    marginBottom: isMobile ? 16 : 30,
    fontSize: isMobile ? '1.25rem' : '1.5rem',
  };

  // 响应式操作栏样式
  const actionBarStyle = {
    marginBottom: 20,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  };

  // 手机端左侧容器样式
  const leftContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  // 响应式标签栏样式
  const tagBarStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
  };

  // 响应式按钮组样式
  const buttonGroupStyle = {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    justifyContent: 'flex-end',
  };

  // 响应式卡片样式
  const cardStyle = isMobile ? { marginBottom: 16 } : { marginBottom: 20 };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? '0px' : '0px' }}>
        <img src="/log1.png" alt="Logo" style={{ width: isMobile ? 72 : 90, height: isMobile ? 72 : 90, objectFit: 'contain' }} />
        <h1 style={{ ...titleStyle, marginBottom: 0, lineHeight: 1.2 }}>Oracle数据管理平台</h1>
      </div>
      
      {/* 顶部操作栏 */}
      <div style={actionBarStyle}>
        {/* 左侧：钱包连接状态和网络信息 */}
        <div style={tagBarStyle}>
          {/* 钱包连接状态标签 */}
          {/* {isConnected ? (
            <Tag
              color="green"
              style={{ cursor: 'pointer', fontSize: isMobile ? '12px' : '14px' }}
              onClick={() => {
                navigator.clipboard.writeText(address);
                message.success('钱包地址已复制到剪贴板');
              }}
            >
              {isMobile ? `${address?.slice(0, 4)}...${address?.slice(-4)}` : `${address?.slice(0, 6)}...${address?.slice(-4)}`}
            </Tag>
          ) : (
            <Tag color="red" style={{ fontSize: isMobile ? '12px' : '14px' }}>未连接钱包</Tag>
          )} */}
          
          {/* 网络信息标签 */}
          {/* {currentChainId && (
            <Tag color="blue" style={{ fontSize: isMobile ? '12px' : '14px' }}>
              {isMobile 
                ? NETWORK_CONFIGS[currentChainId]?.name?.replace(' Testnet', '').replace(' Mainnet', '') || `ID:${currentChainId}`
                : NETWORK_CONFIGS[currentChainId]?.name || `Chain ID: ${currentChainId}`
              }
            </Tag>
          )} */}
          
          {/* 合约配置状态 */}
          {currentChainId && (
            isContractAvailable ? (
              <Tag
                color="green"
                style={{ cursor: 'pointer', fontSize: isMobile ? '12px' : '14px' }}
                onClick={() => {
                  navigator.clipboard.writeText(contractAddress);
                  message.success('合约地址已复制到剪贴板');
                }}
              >
                {isMobile 
                  ? `Oracle: ${contractAddress?.slice(0, 4)}...${contractAddress?.slice(-4)}`
                  : `Oracle合约地址: ${contractAddress?.slice(0, 6)}...${contractAddress?.slice(-4)}`
                }
              </Tag>
            ) : (
              <Tag color="orange" style={{ fontSize: isMobile ? '12px' : '14px' }}>合约未配置</Tag>
            )
          )}
        </div>
        
        {/* 右侧：操作按钮 */}
        <div style={buttonGroupStyle}>
          {/* 角色管理按钮 */}
          <Button 
            icon={<TeamOutlined />} 
            size={isMobile ? 'small' : 'middle'}
            onClick={() => {
              setActiveView('roleManagement');
              fetchRoleList();
            }}
          >
            {isMobile ? '' : '角色管理'}
          </Button>
          
          {/* 项目注册按钮 */}
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            size={isMobile ? 'small' : 'middle'}
            onClick={() => setActiveView('register')}
          >
            {isMobile ? '' : '项目注册'}
          </Button>
        </div>
      </div>
      
      {/* 项目列表视图 - 默认视图 */}
      {activeView === 'projects' && (
        <Card 
          title={isMobile ? '' : '项目列表'} 
          extra={<Button size="small" onClick={fetchProjectList} loading={isLoadingProjects}>刷新</Button>}
          style={cardStyle}
          size={isMobile ? 'small' : 'default'}
        >
          <div>
            {isMobile ? (
              <div>
                {projectList.map(project => (
                  <Card
                    key={project.pid}
                    size="small"
                    style={{ marginBottom: 12, borderRadius: 8 }}
                    bodyStyle={{ padding: 12 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{project.pid}</span>
                        <Tag color={project.isActive ? 'green' : 'red'} style={{ marginLeft: 8 }}>
                          {project.isActive ? '激活' : '禁用'}
                        </Tag>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button
                          size="small"
                          type="link"
                          onClick={() => handleProjectUpload(project)}
                          style={{ padding: '0 4px' }}
                        >
                          上传
                        </Button>
                        <Button
                          size="small"
                          type="link"
                          onClick={() => handleProjectQuery(project)}
                          style={{ padding: '0 4px' }}
                        >
                          查询
                        </Button>
                        <Button
                          size="small"
                          type="link"
                          onClick={() => handleAddAuthorizerForProject(project)}
                          style={{ padding: '0 4px' }}
                        >
                          授权
                        </Button>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>描述:</span> {project.description || '-'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      <span style={{ fontWeight: 500 }}>有效期:</span> {
                        project.dataTTL < 60 ? `${project.dataTTL}秒` :
                        project.dataTTL < 3600 ? `${Math.floor(project.dataTTL / 60)}分钟` :
                        project.dataTTL < 86400 ? `${Math.floor(project.dataTTL / 3600)}小时` :
                        `${Math.floor(project.dataTTL / 86400)}天`
                      }
                    </div>
                  </Card>
                ))}
                {projectList.length === 0 && !isLoadingProjects && (
                  <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                    暂无项目数据
                  </div>
                )}
                {isLoadingProjects && (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <Spin tip="加载中..." />
                  </div>
                )}
              </div>
            ) : (
              <Table
                columns={projectColumns}
                dataSource={projectList}
                rowKey="pid"
                loading={isLoadingProjects}
                pagination={{ pageSize: 10 }}
                size="middle"
              />
            )}
          </div>
        </Card>
      )}
      
      {/* 数据上传视图 */}
      {activeView === 'upload' && (
        <>
          <Button 
            type="link" 
            onClick={handleBackToProjects} 
            style={{ marginBottom: isMobile ? 8 : 16 }}
            size={isMobile ? 'small' : 'middle'}
          >
            {isMobile ? '← 返回' : '← 返回项目列表'}
          </Button>
          {/* 表单 */}
          <Form
            form={form}
            layout={isMobile ? 'vertical' : 'vertical'}
            initialValues={{
              dataDate: new Date().toISOString().split('T')[0],
            }}
            size={isMobile ? 'small' : 'large'}
          >
            {/* 数据上传 */}
            <Card title="数据上传" style={cardStyle} size={isMobile ? 'small' : 'default'}>
              {/* <Form.Item
                name="projectId"
                label="项目ID"
                rules={[{ required: true, message: '请选择项目ID' }]}
                hidden={selectedProject}
              >
                {selectedProject ? (
                  <Input 
                    value={selectedProject.pid}
                    readOnly
                    addonAfter={selectedProject.description}
                  />
                ) : (
                  <Select
                    placeholder="请选择项目ID"
                    loading={isLoadingProjects}
                    showSearch
                    filterOption={(input, option) =>
                      option.children.toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {projectList.map(project => (
                      <Select.Option key={project.pid} value={project.pid}>
                        {project.pid} {project.description ? `- ${project.description}` : ''}
                      </Select.Option>
                    ))}
                  </Select>
                )}
              </Form.Item> */}
              
              <Form.Item
                name="dataDate"
                label="数据日期"
                rules={[{ required: true, message: '请选择数据日期' }]}
              >
                <DatePicker 
                  style={{ width: '100%' }} 
                  format="YYYY-MM-DD" 
                  placeholder="请选择日期"
                  size={isMobile ? 'small' : 'middle'}
                  getPopupContainer={(trigger) => trigger.parentElement}
                  dropdownClassName="mobile-date-picker-dropdown"
                />
              </Form.Item>
            </Card>
            
            {/* 核心数据 */}
            <Card title="核心数据" style={cardStyle} size={isMobile ? 'small' : 'default'}>
              <Form.List
                name="coreData"
                initialValue={[{ key: '', value: '' }]}
                rules={[{ required: true, message: '请至少输入一个核心数据字段' }]}
              >
                {(fields, { add, remove }) => (
                  <div>
                    {fields.map((field, index) => (
                      <div key={`core-data-field-${field.fieldKey}`} style={{ display: 'flex', alignItems: 'center', marginBottom: isMobile ? 4 : 8 }}>
                        <span style={{ color: '#ff4d4f', marginRight: 4, fontSize: isMobile ? '12px' : '14px' }}>*</span>
                        <Form.Item
                          name={[field.name, 'key']}
                          fieldKey={[field.fieldKey, 'key']}
                          rules={[{ required: true, message: '请输入字段键名' }]}
                          style={{ marginRight: isMobile ? 4 : 8, marginBottom: 0, flex: 1 }}
                        >
                          <Input
                            placeholder={`键 ${index + 1}`}
                            size={isMobile ? 'small' : 'middle'}
                          />
                        </Form.Item>
                        <span style={{ color: '#ff4d4f', marginRight: 4, fontSize: isMobile ? '12px' : '14px' }}>*</span>
                        <Form.Item
                          name={[field.name, 'value']}
                          fieldKey={[field.fieldKey, 'value']}
                          rules={[{ required: true, message: '请输入字段值' }]}
                          style={{ marginRight: isMobile ? 4 : 8, marginBottom: 0, flex: 1 }}
                        >
                          <Input
                            placeholder={`值 ${index + 1}`}
                            size={isMobile ? 'small' : 'middle'}
                          />
                        </Form.Item>
                        {fields.length > 1 && (
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => {
                              remove(field.name);
                            }}
                            style={{ marginBottom: 0 }}
                            size={isMobile ? 'small' : 'middle'}
                          />
                        )}
                      </div>
                    ))}
                    
                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => {
                        add();
                      }}
                        style={{ width: '100%' }}
                        icon={<PlusOutlined />}
                        size={isMobile ? 'small' : 'middle'}
                      >
                        {isMobile ? '添加字段' : '添加核心数据字段'}
                      </Button>
                    </Form.Item>
                  </div>
                )}
              </Form.List>
            </Card>
            
            {/* 文件上传 */}
            <Card title="文件上传" style={cardStyle} size={isMobile ? 'small' : 'default'}>
              <Form.Item name="files">
                <Upload
                  multiple
                  beforeUpload={() => false}
                  onChange={handleFileChange}
                  fileList={selectedFiles}
                  customRequest={({ file, onSuccess }) => {
                    onSuccess('success');
                  }}
                >
                  <Button icon={<UploadOutlined />} size={isMobile ? 'small' : 'middle'}>
                    {isMobile ? '选择文件' : '选择多个文件'}
                  </Button>
                </Upload>
              </Form.Item>
              
              {selectedFiles.length > 0 && (
                <div style={{ marginTop: isMobile ? 8 : 16 }}>
                  <h4 style={{ fontSize: isMobile ? '14px' : '16px' }}>已选择文件 ({selectedFiles.length} 个):</h4>
                  <ul style={{ paddingLeft: isMobile ? 16 : 20 }}>
                    {selectedFiles.map((file, index) => (
                      <li key={file.uid || `file-${index}-${file.name}-${file.size}-${file.lastModified || ''}`} style={{ fontSize: isMobile ? '12px' : '14px' }}>
                        {file.name} ({file.size} bytes)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
            
            {/* 操作按钮 */}
            <Card title="操作" style={cardStyle} size={isMobile ? 'small' : 'default'}>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 8 : 16 }}>
                <Button
                  type="primary"
                  onClick={handleUpload}
                  loading={isProcessing}
                  size={isMobile ? 'small' : 'large'}
                  block={isMobile}
                >
                  一键上传
                </Button>
                <Button onClick={handleSaveDraft} size={isMobile ? 'small' : 'large'} block={isMobile}>
                  {draftSaved ? '已保存' : '保存草稿'}
                </Button>
              </div>
            </Card>
            
            {/* 状态显示 */}
            {(txHash || isProcessing) && (
              <Card title="操作状态" style={cardStyle} size={isMobile ? 'small' : 'default'}>
                <Steps 
                  current={currentStep} 
                  status={isProcessing ? 'process' : 'finish'} 
                  items={steps} 
                  size={isMobile ? 'small' : 'default'}
                />
                
                <div style={{ marginTop: isMobile ? 12 : 20 }}>
                  {txHash && (
                    <>
                      <p style={{ fontSize: isMobile ? '12px' : '14px' }}>合约交易哈希: {txHash}</p>
                      <p style={{ fontSize: isMobile ? '12px' : '14px' }}>交易状态: {txStatus}</p>
                      <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: isMobile ? '12px' : '14px' }}>
                        查看交易详情
                      </a>
                    </>
                  )}
                </div>
              </Card>
            )}
          </Form>
        </>
      )}
      
      {/* 项目注册视图 */}
      {activeView === 'register' && (
        <>
          <Button 
            type="link" 
            onClick={handleBackToProjects} 
            style={{ marginBottom: isMobile ? 8 : 16 }}
            size={isMobile ? 'small' : 'middle'}
          >
            {isMobile ? '← 返回' : '← 返回项目列表'}
          </Button>
          <Form
            form={projectForm}
            layout="vertical"
            onFinish={handleRegisterProject}
            size={isMobile ? 'small' : 'large'}
          >
            <Card title="注册新项目" style={cardStyle} size={isMobile ? 'small' : 'default'}>
              <Form.Item
                name="projectId"
                label="项目ID"
                rules={[{ required: true, message: '请输入项目ID' }]}
              >
                <Input placeholder="请输入项目ID" size={isMobile ? 'small' : 'middle'} />
              </Form.Item>
              
              <Form.Item
                name="description"
                label="项目描述"
                rules={[{ required: true, message: '请输入项目描述' }]}
              >
                <TextArea rows={isMobile ? 2 : 4} placeholder="请输入项目描述" />
              </Form.Item>
              
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 0 : 16 }}>
                <Form.Item
                  name="dataTTLValue"
                  label="数据有效期"
                  rules={[{ required: true, message: '请输入数据有效期值' }]}
                  style={{ flex: 1, marginBottom: isMobile ? 8 : 0 }}
                >
                  <Input type="number" placeholder="请输入值" min={1} size={isMobile ? 'small' : 'middle'} />
                </Form.Item>
                
                <Form.Item
                  name="dataTTLUnit"
                  label="时间单位"
                  rules={[{ required: true, message: '请选择时间单位' }]}
                  style={{ flex: 1 }}
                >
                  <Select placeholder="请选择" size={isMobile ? 'small' : 'middle'}>
                    <Select.Option value="seconds">秒</Select.Option>
                    <Select.Option value="minutes">分钟</Select.Option>
                    <Select.Option value="hours">小时</Select.Option>
                    <Select.Option value="days">天</Select.Option>
                    <Select.Option value="weeks">周</Select.Option>
                    <Select.Option value="months">月</Select.Option>
                    <Select.Option value="years">年</Select.Option>
                  </Select>
                </Form.Item>
              </div>
              
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={isProcessing} block={isMobile}>
                  注册项目
                </Button>
              </Form.Item>
            </Card>
          </Form>
        </>
      )}
      
      {/* 添加授权人视图 */}
      {activeView === 'addAuthorizer' && (
        <>
          <Button 
            type="link" 
            onClick={handleBackToProjects} 
            style={{ marginBottom: isMobile ? 8 : 16 }}
            size={isMobile ? 'small' : 'middle'}
          >
            {isMobile ? '← 返回' : '← 返回项目列表'}
          </Button>
          <Form
            form={authorizerForm}
            layout="vertical"
            onFinish={handleAddAuthorizer}
            size={isMobile ? 'small' : 'large'}
          >
            <Card title="添加授权人" style={cardStyle} size={isMobile ? 'small' : 'default'}>
              <Form.Item
                name="projectId"
                label="项目ID"
                rules={[{ required: true, message: '请选择项目ID' }]}
                hidden={selectedProject}
              >
                {selectedProject ? (
                  <Input 
                    value={selectedProject.pid}
                    readOnly
                    addonAfter={selectedProject.description}
                    size={isMobile ? 'small' : 'middle'}
                  />
                ) : (
                  <Select
                    placeholder="请选择项目ID"
                    loading={isLoadingProjects}
                    showSearch
                    filterOption={(input, option) =>
                      option.children.toLowerCase().includes(input.toLowerCase())
                    }
                    size={isMobile ? 'small' : 'middle'}
                  >
                    {projectList.map(project => (
                      <Select.Option key={project.pid} value={project.pid}>
                        {project.pid} {project.description ? `- ${project.description}` : ''}
                      </Select.Option>
                    ))}
                  </Select>
                )}
              </Form.Item>
               
              <Form.Item
                name="submitterAddress"
                label="授权人地址"
                rules={[{ required: true, message: '请输入授权人地址' }]}
              >
                <Input placeholder="请输入授权人地址" size={isMobile ? 'small' : 'middle'} />
              </Form.Item>
               
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={isProcessing} block={isMobile}>
                  添加授权人
                </Button>
              </Form.Item>
            </Card>
          </Form>
        </>
      )}
      
      {/* 数据查询视图 */}
      {activeView === 'query' && (
        <>
          <Button 
            type="link" 
            onClick={handleBackToProjects} 
            style={{ marginBottom: isMobile ? 8 : 16 }}
            size={isMobile ? 'small' : 'middle'}
          >
            {isMobile ? '← 返回' : '← 返回项目列表'}
          </Button>
          
          {/* 显示当前选择的项目信息 */}
          {selectedProject && (
            <Card title="数据查询" style={cardStyle} size={isMobile ? 'small' : 'default'}>
              <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 8 }}><strong>项目ID:</strong> {selectedProject.pid}</p>
              <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 8 }}><strong>描述:</strong> {selectedProject.description}</p>
              <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 8 }}><strong>有效期:</strong> {selectedProject.dataTTL}秒</p>
              <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 0 }}><strong>状态:</strong> <Tag color={selectedProject.isActive ? 'green' : 'red'} style={{ marginLeft: 4 }}>{selectedProject.isActive ? '激活' : '禁用'}</Tag></p>
            </Card>
          )}
          
          {/* 日期选择器模态框 */}
          <Modal
            title="选择查询日期"
            open={isDatePickerModalVisible}
            onCancel={() => setIsDatePickerModalVisible(false)}
            footer={null}
            width={isMobile ? '90%' : 400}
          >
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <DatePicker 
                onChange={(date, dateString) => {
                  setSelectedDateForQuery(date);
                }}
                disabledDate={(current) => {
                  return current && current > new Date();
                }}
              />
              <div style={{ marginTop: 16 }}>
                <Button 
                  type="primary" 
                  onClick={() => {
                    if (selectedDateForQuery) {
                      setIsDatePickerModalVisible(false);
                      handleDateSelect(selectedDateForQuery);
                    } else {
                      message.warning('请选择日期');
                    }
                  }}
                  disabled={!selectedDateForQuery}
                >
                  确认查询
                </Button>
                <Button 
                  style={{ marginLeft: 8 }}
                  onClick={() => setIsDatePickerModalVisible(false)}
                >
                  取消
                </Button>
              </div>
            </div>
          </Modal>
          
          {/* 数据查询结果 */}
          {/* 高级查询功能 - 页签式界面 */}
          {selectedProject && (
            <Card title="" style={cardStyle} size={isMobile ? 'small' : 'default'}>
              <Tabs
                activeKey={activeQueryTab}
                onChange={setActiveQueryTab}
                type={isMobile ? 'line' : 'card'}
                size={isMobile ? 'small' : 'middle'}
                items={[
                  {
                    key: 'latest',
                    label: (
                      <span>
                        <DatabaseOutlined />
                        {isMobile ? '' : '最新数据'}
                      </span>
                    ),
                    children: (
                      <div style={{ padding: isMobile ? '8px 0' : '16px 0' }}>
          {/* 最新数据查询结果 - 只在最新数据页签显示 */}
          {activeQueryTab === 'latest' && latestDataResult && (
            <Card title="" style={cardStyle} size={isMobile ? 'small' : 'default'}>
              <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 4 }}><strong>DataID:</strong> {
                (() => {
                  try {
                    return ethers.decodeBytes32String(latestDataResult.did);
                  } catch {
                    return latestDataResult.did;
                  }
                })()
              }</p>
              <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 8 }}><strong>核心数据:</strong></p>
              {(() => {
                try {
                  const parsedCoreData = DataSerializer.deserialize(latestDataResult.coreData);
                  const entries = Object.entries(parsedCoreData);
                  if (entries.length === 0) {
                    return <p style={{ fontSize: isMobile ? '12px' : '14px', color: '#999' }}>无数据</p>;
                  }
                  return (
                    <div style={{ marginLeft: isMobile ? 8 : 16, marginBottom: 8 }}>
                      {entries.map(([key, value]) => (
                        <p key={key} style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 2 }}>
                          <span style={{ color: '#1890ff' }}>{key}:</span> {value.toString()}
                        </p>
                      ))}
                    </div>
                  );
                } catch (error) {
                  console.error('解析核心数据失败:', error);
                  return <p style={{ fontSize: isMobile ? '12px' : '14px', color: '#ff4d4f' }}>解析失败: {simplifyError(error)}</p>;
                }
              })()}
              <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 4 }}><strong>数据哈希:</strong> <span style={{ wordBreak: 'break-all' }}>{latestDataResult.dataHash}</span></p>
              <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 4 }}><strong>提交者:</strong> {latestDataResult.submitter}</p>
              <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 0 }}><strong>提交时间:</strong> {new Date(latestDataResult.submitTime).toLocaleString()}</p>
            </Card>
          )}
                      </div>
                    )
                  },
                  {
                    key: 'historical',
                    label: (
                      <span>
                        <DatabaseOutlined />
                        {isMobile ? '' : '历史数据'}
                      </span>
                    ),
                    children: (
                      <div style={{ padding: isMobile ? '8px 0' : '16px 0' }}>
                        {/* 历史数据页签内容 */}
                        <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          {/* 按日期查询 */}
                          <div style={{ flex: '1 1 auto' }}>
                            <div style={{ marginBottom: 12, fontWeight: 'bold', fontSize: isMobile ? '14px' : '16px' }}>按日期查询</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <Button 
                                type="primary" 
                                icon={<SearchOutlined />} 
                                onClick={() => setIsDatePickerModalVisible(true)}
                                loading={isQuerying}
                                size={isMobile ? 'small' : 'middle'}
                              >
                                选择日期查询
                              </Button>
                            </div>
                          </div>
                          
                          {/* 按年月范围查询（放在右边） */}
                          <div style={{ flex: '1 1 auto' }}>
                            <div style={{ marginBottom: 12, fontWeight: 'bold', fontSize: isMobile ? '14px' : '16px' }}>按年月范围查询</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <DatePicker
                                picker="month"
                                placeholder="开始年月"
                                style={{ width: isMobile ? '100%' : 180 }}
                                size={isMobile ? 'small' : 'middle'}
                                value={startYearMonth}
                                onChange={(date) => setStartYearMonth(date)}
                              />
                              <DatePicker
                                picker="month"
                                placeholder="结束年月"
                                style={{ width: isMobile ? '100%' : 180 }}
                                size={isMobile ? 'small' : 'middle'}
                                value={endYearMonth}
                                onChange={(date) => setEndYearMonth(date)}
                              />
                              <Button
                                type="primary"
                                onClick={handleGetDataByYearMonthRange}
                                loading={isProcessing}
                                size={isMobile ? 'small' : 'middle'}
                              >
                                查询
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        {/* 查询结果显示区域 */}
                        {dataIdsByYearMonthResult.length > 0 && (
                          <div>
                            {/* 按月份分组展示数据 */}
                            {Object.entries(dataByYearMonthResult).map(([monthKey, monthData]) => (
                              <div key={monthKey} style={{ marginBottom: 24 }}>
                                <h3 style={{ marginBottom: 16, fontSize: isMobile ? '16px' : '18px', color: '#1890ff' }}>
                                  {monthKey} 月数据 ({monthData.length} 条)
                                </h3>
                                
                                {/* 数据卡片列表 */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                  {monthData.map((dataItem) => (
                                    <Card 
                                      key={dataItem.did} 
                                      style={{ 
                                        width: isMobile ? '100%' : 300, 
                                        flex: '1 1 300px',
                                        minWidth: isMobile ? '100%' : 280
                                      }}
                                      size={isMobile ? 'small' : 'default'}
                                    >
                                      <div style={{ fontSize: isMobile ? '12px' : '14px' }}>
                                        <p style={{ marginBottom: 4, fontWeight: 'bold' }}>DataID: {(() => {
                                          try {
                                            return ethers.decodeBytes32String(dataItem.did);
                                          } catch {
                                            return dataItem.did;
                                          }
                                        })()}</p>                                 
                                        <p style={{ marginBottom: 4, fontWeight: 'bold' }}>核心数据:</p>
                                        <div style={{ marginLeft: 8, marginBottom: 8 }}>
                                          {(() => {
                                            try {
                                              const parsedCoreData = DataSerializer.deserialize(dataItem.coreData);
                                              const entries = Object.entries(parsedCoreData);
                                              if (entries.length === 0) {
                                                return <p style={{ color: '#999' }}>无数据</p>;
                                              }
                                              return (
                                                <div>
                                                  {entries.map(([key, value]) => (
                                                    <p key={key} style={{ marginBottom: 2 }}>
                                                      <span style={{ color: '#1890ff' }}>{key}:</span> {value.toString()}
                                                    </p>
                                                  ))}
                                                </div>
                                              );
                                            } catch (error) {
                                              console.error('解析核心数据失败:', error);
                                              return <p style={{ color: '#ff4d4f' }}>解析失败: {simplifyError(error)}</p>;
                                            }
                                          })()}
                                        </div>
                                        
                                        <p style={{ marginBottom: 4 }}><strong>数据哈希:</strong> <span style={{ wordBreak: 'break-all', fontSize: isMobile ? '10px' : '12px' }}>{dataItem.dataHash}</span></p>
                                        <p style={{ marginBottom: 4 }}><strong>提交者:</strong> <span style={{ wordBreak: 'break-all', fontSize: isMobile ? '10px' : '12px' }}>{dataItem.submitter}</span></p>
                                        <p style={{ marginBottom: 8, color: '#666' }}>提交时间: {new Date(dataItem.submitTime).toLocaleString()}</p>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* 按日期查询结果 */}
                        {dataResult && (
                          <Card 
                            title="查询结果"
                            style={cardStyle}
                            size={isMobile ? 'small' : 'default'}
                          >
                            {/* <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 4 }}><strong>项目ID:</strong> {
                              (() => {
                                try {
                                  return ethers.decodeBytes32String(dataResult.pid);
                                } catch {
                                  return dataResult.pid;
                                }
                              })()
                            }</p> */}
                            <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 4 }}><strong>DataID:</strong> {
                              (() => {
                                try {
                                  return ethers.decodeBytes32String(dataResult.did);
                                } catch {
                                  return dataResult.did;
                                }
                              })()
                            }</p>
                            <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 8 }}><strong>核心数据:</strong></p>
                            {(() => {
                              try {
                                const parsedCoreData = DataSerializer.deserialize(dataResult.coreData);
                                const entries = Object.entries(parsedCoreData);
                                if (entries.length === 0) {
                                  return <p style={{ fontSize: isMobile ? '12px' : '14px', color: '#999' }}>无数据</p>;
                                }
                                return (
                                  <div style={{ marginLeft: isMobile ? 8 : 16, marginBottom: 8 }}>
                                    {entries.map(([key, value]) => (
                                      <p key={key} style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 2 }}>
                                        <span style={{ color: '#1890ff' }}>{key}:</span> {value.toString()}
                                      </p>
                                    ))}
                                  </div>
                                );
                              } catch (error) {
                                console.error('解析核心数据失败:', error);
                                return <p style={{ fontSize: isMobile ? '12px' : '14px', color: '#ff4d4f' }}>解析失败: {simplifyError(error)}</p>;
                              }
                            })()}
                            <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 4 }}><strong>数据哈希:</strong> <span style={{ wordBreak: 'break-all' }}>{dataResult.dataHash}</span></p>
                            <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 4 }}><strong>提交者:</strong> {dataResult.submitter}</p>
                            <p style={{ fontSize: isMobile ? '12px' : '14px', marginBottom: 0 }}><strong>提交时间:</strong> {new Date(dataResult.submitTime).toLocaleString()}</p>
                          </Card>
                        )}
                      </div>
                    )
                  }
                ]}
              />
            </Card>
          )}
        
        </>
      )}
      
      {/* 角色管理视图 */}
      {activeView === 'roleManagement' && (
        <>
          <Button 
            type="link" 
            onClick={handleBackToProjects} 
            style={{ marginBottom: isMobile ? 8 : 16 }}
            size={isMobile ? 'small' : 'middle'}
          >
            {isMobile ? '← 返回' : '← 返回项目列表'}
          </Button>
          
          <Tabs 
            defaultActiveKey="admin"
            type={isMobile ? 'line' : 'card'}
            size={isMobile ? 'small' : 'middle'}
            items={[
              {
                key: 'admin',
                label: (
                  <span>
                    <SafetyCertificateOutlined />
                    {isMobile ? '' : '管理员'}
                  </span>
                ),
                children: (
                  <Card title="管理员管理" style={cardStyle} size={isMobile ? 'small' : 'default'}>
                    <div style={{ marginBottom: isMobile ? 12 : 20 }}>
                      <h4 style={{ fontSize: isMobile ? '14px' : '16px', marginBottom: 8 }}>现有管理员 ({adminList.length} 人)</h4>
                      {isLoadingRoles ? (
                        <Spin tip="加载中..." />
                      ) : adminList.length > 0 ? (
                        <List
                          bordered
                          dataSource={adminList}
                          renderItem={item => (
                            <List.Item
                              actions={[
                                <Button
                                  type="link"
                                  danger
                                  size="small"
                                  onClick={() => {
                                    Modal.confirm({
                                      title: '确认撤销管理员角色',
                                      content: `确定要撤销地址 ${item.slice(0, 6)}...${item.slice(-4)} 的管理员角色吗？`,
                                      onOk: () => directRevokeRole('admin', item)
                                    });
                                  }}
                                >
                                  撤销
                                </Button>
                              ]}
                            >
                              <Tooltip title={item}>
                                <span style={{ cursor: 'pointer', fontSize: isMobile ? '12px' : '14px' }} onClick={() => {
                                  navigator.clipboard.writeText(item);
                                  message.success('地址已复制到剪贴板');
                                }}>
                                  {item.slice(0, isMobile ? 4 : 6)}...{item.slice(-4)}
                                </span>
                              </Tooltip>
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Empty description="暂无管理员" />
                      )}
                    </div>
                    
                    <Divider style={{ margin: isMobile ? '12px 0' : '16px 0' }} />
                    
                    <h4 style={{ fontSize: isMobile ? '14px' : '16px', marginBottom: 8 }}>添加管理员</h4>
                    <Form
                      form={roleForm}
                      layout={isMobile ? 'vertical' : 'inline'}
                      onFinish={handleGrantRole}
                      size={isMobile ? 'small' : 'middle'}
                    >
                      <Form.Item
                        name="address"
                        rules={[
                          { required: true, message: '请输入地址' },
                          { pattern: /^0x[a-fA-F0-9]{40}$/, message: '请输入有效的以太坊地址' }
                        ]}
                        style={{ marginBottom: isMobile ? 8 : 0 }}
                      >
                        <Input placeholder="输入以太坊地址 (0x...)" style={{ width: isMobile ? '100%' : 400 }} />
                      </Form.Item>
                      <Form.Item name="roleType" initialValue="admin" hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={grantRoleLoading} block={isMobile}>
                          添加
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                )
              },
              {
                key: 'dataUploader',
                label: (
                  <span>
                    <CloudUploadOutlined />
                    {isMobile ? '' : '数据上传者'}
                  </span>
                ),
                children: (
                  <Card title="数据上传者管理" style={cardStyle} size={isMobile ? 'small' : 'default'}>
                    <div style={{ marginBottom: isMobile ? 12 : 20 }}>
                      <h4 style={{ fontSize: isMobile ? '14px' : '16px', marginBottom: 8 }}>现有数据上传者 ({dataUploaderList.length} 人)</h4>
                      {isLoadingRoles ? (
                        <Spin tip="加载中..." />
                      ) : dataUploaderList.length > 0 ? (
                        <List
                          bordered
                          dataSource={dataUploaderList}
                          renderItem={item => (
                            <List.Item
                              actions={[
                                <Button
                                  type="link"
                                  danger
                                  size="small"
                                  onClick={() => {
                                    Modal.confirm({
                                      title: '确认撤销数据上传者角色',
                                      content: `确定要撤销地址 ${item.slice(0, 6)}...${item.slice(-4)} 的数据上传者角色吗？`,
                                      onOk: () => directRevokeRole('dataUploader', item)
                                    });
                                  }}
                                >
                                  撤销
                                </Button>
                              ]}
                            >
                              <Tooltip title={item}>
                                <span style={{ cursor: 'pointer', fontSize: isMobile ? '12px' : '14px' }} onClick={() => {
                                  navigator.clipboard.writeText(item);
                                  message.success('地址已复制到剪贴板');
                                }}>
                                  {item.slice(0, isMobile ? 4 : 6)}...{item.slice(-4)}
                                </span>
                              </Tooltip>
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Empty description="暂无数据上传者" />
                      )}
                    </div>
                    
                    <Divider style={{ margin: isMobile ? '12px 0' : '16px 0' }} />
                    
                    <h4 style={{ fontSize: isMobile ? '14px' : '16px', marginBottom: 8 }}>添加数据上传者</h4>
                    <Form
                      form={roleForm}
                      layout={isMobile ? 'vertical' : 'inline'}
                      onFinish={handleGrantRole}
                      size={isMobile ? 'small' : 'middle'}
                    >
                      <Form.Item
                        name="address"
                        rules={[
                          { required: true, message: '请输入地址' },
                          { pattern: /^0x[a-fA-F0-9]{40}$/, message: '请输入有效的以太坊地址' }
                        ]}
                        style={{ marginBottom: isMobile ? 8 : 0 }}
                      >
                        <Input placeholder="输入以太坊地址 (0x...)" style={{ width: isMobile ? '100%' : 400 }} />
                      </Form.Item>
                      <Form.Item name="roleType" initialValue="dataUploader" hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={grantRoleLoading} block={isMobile}>
                          添加
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                )
              }
            ]}
          />
        </>
      )}
    </div>
  );
};

export default FileUploadForm;