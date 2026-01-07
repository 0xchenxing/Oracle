// 测试序列化器功能
const fs = require('fs');
const path = require('path');

// 读取dataSerializer.js文件内容
const serializerPath = path.join(__dirname, 'src', 'utils', 'dataSerializer.js');
const serializerContent = fs.readFileSync(serializerPath, 'utf8');

// 移除ES6模块导出和示例代码，使其能在Node.js中直接运行
const modifiedContent = serializerContent
  .replace('export default DataSerializer;', '')
  .replace('export { toHexString, fromHexString };', '')
  .replace(/^\/\/ 使用示例[\s\S]*$/, '');

// 执行修改后的代码
 eval(modifiedContent);

// 测试数据
const testData = {
  'key1': 12345,
  'key2': BigInt('12345678901234567890'),
  'key3': 0,
  'key4': BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935') // 2^256-1
};

console.log('测试数据:', testData);

// 编码
const encoded = DataSerializer.serialize(testData);
console.log('编码后字节数组:', encoded);
console.log('Hex格式:', toHexString(encoded));

// 解码
const decoded = DataSerializer.deserialize(encoded);
console.log('解码后数据:', decoded);

// 验证数据一致性
const testStr = JSON.stringify(Object.fromEntries(Object.entries(testData).map(([k, v]) => [k, v.toString()]))).toLowerCase();
const decodedStr = JSON.stringify(Object.fromEntries(Object.entries(decoded).map(([k, v]) => [k, v.toString()]))).toLowerCase();
console.log('数据一致:', testStr === decodedStr);

// 验证特定值
console.log('key1一致:', testData.key1.toString() === decoded.key1.toString());
console.log('key2一致:', testData.key2.toString() === decoded.key2.toString());
console.log('key3一致:', testData.key3.toString() === decoded.key3.toString());
console.log('key4一致:', testData.key4.toString() === decoded.key4.toString());
