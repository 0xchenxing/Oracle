// 简单测试序列化器功能

// 直接复制序列化器代码
class DataSerializer {
  static serialize(data) {
    const entries = Object.entries(data);
    const buffers = [];
    buffers.push(this.encodeVarInt(entries.length));
    for (const [key, value] of entries) {
      if (typeof key !== 'string') {
        throw new Error(`键必须是string类型，当前类型: ${typeof key}`);
      }
      const uintValue = BigInt(value);
      if (uintValue < 0n || uintValue >= 2n ** 256n) {
        throw new Error('值必须是0到2^256-1之间的无符号整数');
      }
      const keyBytes = Buffer.from(key, 'utf8');
      buffers.push(this.encodeVarInt(keyBytes.length));
      buffers.push(keyBytes);
      buffers.push(this.encodeVarInt(uintValue));
    }
    return Buffer.concat(buffers);
  }

  static deserialize(input) {
    let bytes = input instanceof Buffer ? input : Buffer.from(input, 'hex');
    const result = {};
    let offset = 0;
    const [count, countBytes] = this.decodeVarInt(bytes, offset);
    offset += countBytes;
    for (let i = 0; i < count; i++) {
      const [keyLength, keyLenBytes] = this.decodeVarInt(bytes, offset);
      offset += keyLenBytes;
      const keyBytes = bytes.slice(offset, offset + keyLength);
      const key = keyBytes.toString('utf8');
      offset += keyLength;
      const [value, valueBytes] = this.decodeVarInt(bytes, offset);
      offset += valueBytes;
      result[key] = value;
    }
    return result;
  }

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
        byte |= 0x80;
      }
      bytes.push(byte);
      if (n === 0n) {
        break;
      }
    }
    return Buffer.from(bytes);
  }

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
      if (bytesRead > 35) {
        throw new Error('varint编码过长，超过uint256范围');
      }
    } while ((byte & 0x80) !== 0);
    return [result, bytesRead];
  }
}

function toHexString(bytes) {
  return bytes.toString('hex');
}

// 测试数据
const testData = {
  'projectId': 12345,
  'timestamp': 1698765432100,
  'value': BigInt('12345678901234567890'),
  'status': 1,
  'version': 2
};

console.log('测试数据:', testData);

// 编码
const encoded = DataSerializer.serialize(testData);
console.log('编码后:', encoded);
console.log('Hex格式:', toHexString(encoded));

// 解码
const decoded = DataSerializer.deserialize(encoded);
console.log('解码后数据:', decoded);

// 验证数据一致性
const testStr = JSON.stringify(Object.fromEntries(Object.entries(testData).map(([k, v]) => [k, v.toString()]))).toLowerCase();
const decodedStr = JSON.stringify(Object.fromEntries(Object.entries(decoded).map(([k, v]) => [k, v.toString()]))).toLowerCase();
console.log('数据一致:', testStr === decodedStr);

// 验证特定值
console.log('projectId一致:', testData.projectId.toString() === decoded.projectId.toString());
console.log('timestamp一致:', testData.timestamp.toString() === decoded.timestamp.toString());
console.log('value一致:', testData.value.toString() === decoded.value.toString());
console.log('status一致:', testData.status.toString() === decoded.status.toString());
console.log('version一致:', testData.version.toString() === decoded.version.toString());
