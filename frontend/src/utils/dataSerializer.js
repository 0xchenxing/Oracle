/* eslint-disable no-undef */
/**
 * 数据序列化器 - 按照 [数据数量: varint] + [键长度: varint] + [键: bytes] + [值: varint] + ... 的格式
 * 键为string类型，值为uint256类型（无符号256位整数）
 * 使用标准protobuf风格的varint编码
 */
class DataSerializer {
  /**
   * 编码键值对数据到二进制格式
   * @param {Object} data - 键值对对象 {string: number|bigint}
   * @returns {Uint8Array} - 编码后的二进制数据
   */
  static serialize(data) {
    // 转换为数组形式以便处理
    const entries = Object.entries(data);
    const buffers = [];
    
    // 1. 编码数据数量 (varint)
    buffers.push(this.encodeVarInt(entries.length));
    
    // 2. 编码每个键值对
    for (const [key, value] of entries) {
      // 验证键类型
      if (typeof key !== 'string') {
        throw new Error(`键必须是string类型，当前类型: ${typeof key}`);
      }
      
      // 验证值类型和范围 (uint256)
      const uintValue = BigInt(value);
      if (uintValue < 0n || uintValue >= 2n ** 256n) {
        throw new Error('值必须是0到2^256-1之间的无符号整数');
      }
      
      // 编码键：键长度(varint) + 键(bytes)
      const keyBytes = new TextEncoder().encode(key);
      buffers.push(this.encodeVarInt(keyBytes.length));
      buffers.push(keyBytes);
      
      // 编码值：varint格式的uint256
      buffers.push(this.encodeVarInt(uintValue));
    }
    
    // 合并所有buffer
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const buf of buffers) {
      result.set(buf, offset);
      offset += buf.length;
    }
    
    return result;
  }
  
  /**
   * 从二进制格式解码键值对数据
   * @param {Uint8Array|string} input - 编码后的二进制数据或十六进制字符串
   * @returns {Object} - 解码后的键值对对象
   */
  static deserialize(input) {
    // 处理输入类型
    let bytes;
    if (typeof input === 'string') {
      bytes = this.hexToUint8Array(input);
    } else if (input instanceof Uint8Array) {
      bytes = input;
    } else {
      throw new Error('输入必须是Uint8Array或十六进制字符串');
    }
    
    const result = {};
    let offset = 0;
    
    // 1. 解码数据数量
    const [count, countBytes] = this.decodeVarInt(bytes, offset);
    offset += countBytes;
    
    // 2. 解码每个键值对
    for (let i = 0; i < count; i++) {
      // 解码键长度
      const [keyLength, keyLenBytes] = this.decodeVarInt(bytes, offset);
      offset += keyLenBytes;
      
      // 解码键
      const keyLengthNum = Number(keyLength);
      const keyBytes = bytes.slice(offset, offset + keyLengthNum);
      const key = new TextDecoder().decode(keyBytes);
      offset += keyLengthNum;
      
      // 解码值
      const [value, valueBytes] = this.decodeVarInt(bytes, offset);
      offset += valueBytes;
      
      result[key] = value;
    }
    
    return result;
  }
  
  /**
   * 标准protobuf风格的varint编码（无符号）
   * 每字节最高位表示是否继续，低7位存储数据
   * 支持uint256无符号整数
   * @param {number|bigint} value - 要编码的无符号整数
   * @returns {Uint8Array} - 编码后的字节数组
   */
  static encodeVarInt(value) {
    const uintValue = BigInt(value);
    const bytes = [];
    
    if (uintValue < 0n) {
      throw new Error('varint编码仅支持非负整数');
    }
    
    let n = uintValue;
    
    while (true) {
      let byte = Number(n & 0x7Fn);
      n >>= 7n;
      
      if (n !== 0n) {
        byte |= 0x80;  // 设置继续位
      }
      
      bytes.push(byte);
      
      if (n === 0n) {
        break;
      }
    }
    
    return new Uint8Array(bytes);
  }
  
  /**
   * 标准protobuf风格的varint解码（无符号）
   * 支持uint256无符号整数
   * @param {Uint8Array} bytes - 字节数组
   * @param {number} offset - 起始偏移量
   * @returns {[bigint, number]} - [解码后的值, 读取的字节数]
   */
  static decodeVarInt(bytes, offset = 0) {
    let result = 0n;
    let shift = 0n;
    let byte;
    let bytesRead = 0;
    
    do {
      if (offset + bytesRead >= bytes.length) {
        throw new Error('varint数据不完整');
      }
      
      byte = bytes[offset + bytesRead];
      result |= BigInt(byte & 0x7F) << shift;
      shift += 7n;
      bytesRead++;
      
      // 防止过大的数字导致性能问题（uint256最多需要35字节）
      if (bytesRead > 35) {
        throw new Error('varint编码过长，超过uint256范围');
      }
    } while ((byte & 0x80) !== 0);
    
    return [result, bytesRead];
  }
  
  /**
   * 辅助方法：十六进制字符串转Uint8Array
   * @param {string} hex - 十六进制字符串
   * @returns {Uint8Array} - 字节数组
   */
  static hexToUint8Array(hex) {
    // 移除可能的0x前缀
    hex = hex.startsWith('0x') ? hex.slice(2) : hex;
    
    // 确保长度为偶数
    if (hex.length % 2 !== 0) {
      hex = '0' + hex;
    }
    
    const result = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      result[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return result;
  }
  
  /**
   * 辅助方法：Uint8Array转十六进制字符串
   * @param {Uint8Array} bytes - 字节数组
   * @returns {string} - 十六进制字符串
   */
  static uint8ArrayToHex(bytes) {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// 辅助函数：将Uint8Array转换为十六进制字符串（便于上链）
function toHexString(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHexString(hex) {
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    result[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return result;
}

// 导出序列化器
export default DataSerializer;
export { toHexString, fromHexString };