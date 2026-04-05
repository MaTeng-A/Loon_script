// 天气App网络请求探测脚本
const url = $request.url;
const method = $request.method;
const currentTime = new Date().toLocaleString();

console.log(`🕒 时间: ${currentTime}`);
console.log(`🌐 请求方式: ${method}`);
console.log(`🔗 完整URL: ${url}`);

// 解析URL，提取关键信息
let urlInfo;
try {
    urlInfo = new URL(url);
    console.log(`🏠 主机名: ${urlInfo.hostname}`);
    console.log(`📂 路径: ${urlInfo.pathname}`);
} catch(e) {
    console.log("URL解析失败");
}

// 分析可能的坐标信息
let coordinateInfo = "未检测到坐标信息";
if (url.includes("lat=") || url.includes("latitude=")) {
    const latMatch = url.match(/[?&]lat(?:itude)?=([^&]+)/);
    const lngMatch = url.match(/[?&]lng(?:itude)?=([^&]+)/);
    if (latMatch && lngMatch) {
        coordinateInfo = `检测到坐标: ${latMatch[1]}, ${lngMatch[1]}`;
    }
}
console.log(`📍 ${coordinateInfo}`);

// 添加分隔线
console.log("-".repeat(50));

$done({});
