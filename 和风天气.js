// 名称: 精简天气日报 - 和风天气最终版
// 描述: 使用和风天气API，每3小时运行一次，显示实时天气和未来3小时预报
// 版本: 5.0 - 完整时间控制版本
// 更新时间: 2025-12-03

// === API 配置 ===
const HEFENG_API_KEY = "c67667bda2ec440d9cacddc892f281d5";
const TENCENT_TOKEN = "F7NBZ-MC3R3-6AV3J-RR75X-KKDTE-EKFLQ";
const TIANAPI_KEY = "8fb6b3bc5bbe9ee420193601d13f9162";

// 调试模式开关 - 设置为false时按照正常时间逻辑运行
const DEBUG_MODE = false;

// === 主函数 ===
function main() {
    console.log("🌤️ 开始获取天气信息...");
    
    // 检查运行时间
    const isLastRun = isLastRunTime();
    console.log(`🕒 当前时间: ${getCurrentTime()}`);
    console.log(`📅 最后运行时段(22:17及之后): ${isLastRun}`);
    
    // 只使用GPS定位 - 使用拦截脚本的键名
    const gpsData = $persistentStore.read("accurate_gps_location");
    
    if (gpsData) {
        try {
            const location = JSON.parse(gpsData);
            console.log("✅ 使用高精度GPS定位");
            console.log(`📍 GPS坐标: ${location.latitude}, ${location.longitude}`);
            
            // 使用GPS坐标获取地址信息
            getAddressFromGPSCoordinates(location.latitude, location.longitude)
                .then(address => {
                    getHefengWeather(
                        location.latitude, 
                        location.longitude, 
                        address.province, 
                        address.city, 
                        address.district,
                        isLastRun
                    );
                })
                .catch(error => {
                    console.log("❌ 地址获取失败，使用坐标直接获取天气:", error);
                    getHefengWeather(location.latitude, location.longitude, "", "", "", isLastRun);
                });
            return;
        } catch (e) {
            console.log("❌ GPS定位数据解析失败:", e);
            handleError("GPS定位失败", "GPS数据格式错误，请确保GPS拦截脚本正常运行");
        }
    } else {
        console.log("❌ 未找到GPS定位数据");
        handleError("定位失败", "未找到GPS定位数据，请确保GPS拦截脚本已启用并运行");
    }
}

// === 根据GPS坐标获取地址信息 ===
function getAddressFromGPSCoordinates(lat, lng) {
    return new Promise((resolve, reject) => {
        const geocoderUrl = `https://apis.map.qq.com/ws/geocoder/v1/?key=${TENCENT_TOKEN}&location=${lat},${lng}`;
        
        $httpClient.get(geocoderUrl, function(error, response, data) {
            if (error) {
                reject(error);
                return;
            }
            
            try {
                const result = JSON.parse(data);
                if (result.status === 0) {
                    const address = result.result.address_component;
                    resolve({
                        province: address.province,
                        city: address.city,
                        district: address.district,
                        street: address.street || ""
                    });
                } else {
                    reject(new Error("逆地理编码失败"));
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}

// === 获取和风天气数据 ===
function getHefengWeather(lat, lng, province, city, district, isLastRun) {
    console.log("⏳ 获取和风天气数据...");
    
    const location = `${lng},${lat}`;
    
    // 并行获取核心数据
    Promise.all([
        getNowWeather(location),
        getHourlyWeather(location),
        getDailyWeather(location), // 改为7天预报
        getAirQuality(location)
    ]).then(([nowData, hourlyData, dailyData, airData]) => {
        console.log("✅ 天气数据获取成功");
        console.log(`📅 获取到 ${dailyData.length} 天预报数据`);
        
        // 获取明天日期（用于生活指数）
        const tomorrowDate = dailyData.length > 1 ? dailyData[1]?.fxDate : "";
        
        if (DEBUG_MODE) {
            // 调试模式：每次都发送两个通知，并在日志中显示生活指数
            console.log("🔧 调试模式：发送两个通知，并在日志中显示生活指数");
            
            // 1. 先获取诗句并发送今日天气预报
            getWeatherPoetry(nowData.text).then(poetry => {
                processTodayWeather(nowData, hourlyData, dailyData, airData, province, city, district, poetry, true);
                
                // 2. 间隔1秒后发送未来三天天气预报
                setTimeout(() => {
                    processThreeDayWeather(dailyData, province, city, district);
                    
                    // 3. 再间隔1秒后获取并记录明日全部生活指数到日志
                    setTimeout(() => {
                        if (tomorrowDate) {
                            console.log("📊 开始获取全部生活指数...");
                            getAllLivingIndices(location, tomorrowDate, province, city, district);
                        } else {
                            console.log("❌ 无法获取明天日期，跳过生活指数");
                            $done();
                        }
                    }, 1000);
                }, 1000);
            });
            
        } else {
            // 正常模式：根据时间判断
            if (isLastRun) {
                // 22:17及之后：发送两个通知，并在日志中显示生活指数
                console.log("🌙 22:17最后一次运行，发送明日天气预报并显示生活指数");
                
                // 1. 先获取诗句并发送今日天气预报
                getWeatherPoetry(nowData.text).then(poetry => {
                    processTodayWeather(nowData, hourlyData, dailyData, airData, province, city, district, poetry, true);
                    
                    // 2. 间隔1秒后发送未来三天天气预报
                    setTimeout(() => {
                        processThreeDayWeather(dailyData, province, city, district);
                        
                        // 3. 再间隔1秒后获取并记录明日全部生活指数到日志
                        setTimeout(() => {
                            if (tomorrowDate) {
                                console.log("📊 开始获取全部生活指数...");
                                getAllLivingIndices(location, tomorrowDate, province, city, district);
                            } else {
                                console.log("❌ 无法获取明天日期，跳过生活指数");
                                $done();
                            }
                        }, 1000);
                    }, 1000);
                });
                
            } else {
                // 正常时段只显示当天天气+诗句
                console.log("☀️ 正常时段，仅显示当天天气");
                getWeatherPoetry(nowData.text).then(poetry => {
                    processTodayWeather(nowData, hourlyData, dailyData, airData, province, city, district, poetry, false);
                });
            }
        }
        
    }).catch(error => {
        handleError("天气获取失败", error.message || error);
    });
}

// === 获取实时天气 ===
function getNowWeather(location) {
    return new Promise((resolve, reject) => {
        const url = `https://devapi.qweather.com/v7/weather/now?key=${HEFENG_API_KEY}&location=${location}`;
        
        $httpClient.get(url, function(error, response, data) {
            if (error) {
                reject(error);
                return;
            }
            
            try {
                const result = JSON.parse(data);
                if (result.code === "200") {
                    resolve(result.now);
                } else {
                    reject(new Error(result.message));
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}

// === 获取逐小时预报 ===
function getHourlyWeather(location) {
    return new Promise((resolve, reject) => {
        const url = `https://devapi.qweather.com/v7/weather/24h?key=${HEFENG_API_KEY}&location=${location}`;
        
        $httpClient.get(url, function(error, response, data) {
            if (error) {
                reject(error);
                return;
            }
            
            try {
                const result = JSON.parse(data);
                if (result.code === "200") {
                    // 只取未来3小时的数据
                    const next3Hours = result.hourly.slice(0, 3);
                    resolve(next3Hours);
                } else {
                    reject(new Error(result.message));
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}

// === 获取每日预报 ===
function getDailyWeather(location) {
    return new Promise((resolve, reject) => {
        // 改为7天预报API，以获取足够的天数
        const url = `https://devapi.qweather.com/v7/weather/7d?key=${HEFENG_API_KEY}&location=${location}`;
        
        $httpClient.get(url, function(error, response, data) {
            if (error) {
                reject(error);
                return;
            }
            
            try {
                const result = JSON.parse(data);
                if (result.code === "200") {
                    console.log(`📊 7天预报数据: ${result.daily.length} 天`);
                    resolve(result.daily);
                } else {
                    reject(new Error(result.message));
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}

// === 获取空气质量 ===
function getAirQuality(location) {
    return new Promise((resolve, reject) => {
        const url = `https://devapi.qweather.com/v7/air/now?key=${HEFENG_API_KEY}&location=${location}`;
        
        $httpClient.get(url, function(error, response, data) {
            if (error) {
                reject(error);
                return;
            }
            
            try {
                const result = JSON.parse(data);
                if (result.code === "200") {
                    resolve(result.now);
                } else {
                    // 空气质量API可能失败，返回默认值
                    resolve({
                        aqi: "未知",
                        category: "未知",
                        pm2p5: "未知"
                    });
                }
            } catch (e) {
                // 失败时返回默认值
                resolve({
                    aqi: "未知",
                    category: "未知",
                    pm2p5: "未知"
                });
            }
        });
    });
}

// === 获取天气诗句 ===
function getWeatherPoetry(weatherText) {
    return new Promise((resolve) => {
        const tqtype = getTianapiWeatherTypeFromText(weatherText);
        let poetryUrl = `https://api.tianapi.com/tianqishiju/index?key=${TIANAPI_KEY}`;
        
        if (tqtype) {
            poetryUrl += `&tqtype=${tqtype}`;
        }
        
        $httpClient.get(poetryUrl, function(error, response, data) {
            let poetry = "今日天气宜人，愿您心情舒畅。";
            if (!error) {
                try {
                    const poetryJson = JSON.parse(data);
                    if (poetryJson.code === 200 && poetryJson.newslist && poetryJson.newslist.length > 0) {
                        poetry = poetryJson.newslist[0].content;
                        console.log("✅ 天气诗句获取成功");
                    }
                } catch (e) {
                    console.log("❌ 天气诗句获取失败");
                }
            }
            resolve(poetry);
        });
    });
}

// === 获取全部生活指数 ===
function getAllLivingIndices(location, targetDate, province, city, district) {
    console.log("📊 开始获取全部生活指数数据...");
    
    // 使用type=0获取全部天气指数
    const url = `https://devapi.qweather.com/v7/indices/1d?key=${HEFENG_API_KEY}&location=${location}&type=0`;
    
    $httpClient.get(url, function(error, response, data) {
        if (error) {
            console.log("❌ 生活指数获取失败:", error);
            logDefaultLivingIndices(province, city, district, targetDate);
            return;
        }
        
        try {
            const result = JSON.parse(data);
            if (result.code === "200") {
                console.log(`✅ 成功获取到 ${result.daily.length} 个生活指数`);
                logLivingIndices(result.daily, targetDate, province, city, district);
            } else {
                console.log("❌ 生活指数API返回错误:", result.message);
                logDefaultLivingIndices(province, city, district, targetDate);
            }
        } catch (e) {
            console.log("❌ 生活指数数据解析失败:", e);
            logDefaultLivingIndices(province, city, district, targetDate);
        }
    });
}

// === 处理当天天气数据 ===
function processTodayWeather(nowData, hourlyData, dailyData, airData, province, city, district, poetry, showAllNotifications) {
    try {
        // 1. 基础信息
        const currentTemp = Math.round(nowData.temp);
        const feelsLike = Math.round(nowData.feelsLike);
        const humidity = nowData.humidity;
        const pressure = Math.round(nowData.pressure);
        const visibility = nowData.vis;
        const windSpeed = nowData.windSpeed;
        const windDir = nowData.windDir;
        const windScale = nowData.windScale;
        const weatherText = nowData.text;
        const cloud = nowData.cloud || "未知"; // 云量
        const iconCode = nowData.icon; // 和风天气图标代码
        
        // 2. 今日温度范围
        const todayForecast = dailyData[0];
        const minTemp = Math.round(todayForecast.tempMin);
        const maxTemp = Math.round(todayForecast.tempMax);
        
        // 3. 空气质量
        const aqi = airData.aqi;
        const airCategory = airData.category;
        const pm25 = airData.pm2p5;
        
        // 4. 降水信息（如果下雨）
        let precipitation = "";
        if (nowData.precip && parseFloat(nowData.precip) > 0) {
            precipitation = `   🌧️ 降水量: ${nowData.precip}mm`;
        }
        
        // 构建通知内容
        const title = "🌤️ 天气日报";
        
        // 显示定位来源
        const gpsData = $persistentStore.read("accurate_gps_location");
        let locationSource = "📍";
        if (gpsData) {
            const location = JSON.parse(gpsData);
            if (location.source === "weatherkit_apple_full") {
                locationSource = "📍📡"; // GPS图标+信号图标
            }
        }
        
        // 获取天气图标Emoji
        const weatherEmoji = getWeatherEmoji(weatherText);
        
        const subtitle = `${locationSource}${province}${city}${district}（${minTemp}℃~${maxTemp}℃）| ${currentTemp}℃ | ${weatherEmoji}${weatherText}`;
        
        let body = "";
        
        // 实时天气详情
        body += `🌡️ 实时温度: ${currentTemp}℃\n`;
        body += `🤒 体感温度: ${feelsLike}℃\n`;
        body += `💨 风力风向: ${windDir} ${windScale}级 (${windSpeed}km/h)\n`;
        body += `💧 相对湿度: ${humidity}%\n`;
        body += `📊 大气压强: ${pressure}hPa${precipitation}\n`;
        body += `👁️ 能见度: ${visibility}km\n`;
        body += `☁️ 云量: ${cloud}%\n`;
        
        // 空气质量
        body += `🌫️ 空气质量: ${airCategory} (AQI:${aqi})  PM2.5: ${pm25}\n\n`;
        
        // 未来3小时预报 - 时间段格式
        body += "⏰ 未来3小时预报:\n";
        hourlyData.forEach((hour, index) => {
            const timeStr = hour.fxTime;
            const hourDate = new Date(timeStr);
            const startHour = hourDate.getHours();
            const endHour = (startHour + 1) % 24;
            
            // 格式化时间
            const startTime = `${startHour}:00`;
            const endTime = `${endHour}:00`;
            
            const hourTemp = Math.round(hour.temp);
            const hourWeather = hour.text;
            const hourIconCode = hour.icon;
            const hourEmoji = getWeatherEmoji(hourWeather);
            
            body += `     ${startTime}~${endTime} ${hourEmoji}${hourWeather} ${hourTemp}℃\n`;
        });
        
        body += "\n";
        
        // 诗句
        body += `📜 ${poetry}`;
        
        // 获取天气图标（使用和风天气官方图标）
        const iconUrl = getHeWeatherIcon(iconCode);
        
        console.log("✅ 准备发送当天天气通知");
        
        // 发送通知
        $notification.post(title, subtitle, body, {
            "icon": iconUrl
        });
        
        // 如果不是要显示所有通知，则结束脚本
        if (!showAllNotifications) {
            $done();
        }
        
    } catch (e) {
        handleError("天气数据处理失败", e.message);
    }
}

// === 处理未来三天天气预报 ===
function processThreeDayWeather(dailyData, province, city, district) {
    try {
        // 安全检查：确保有足够的数据
        // 我们需要从第2天开始取3天（明天、后天、大后天），所以至少需要4天的数据
        if (!dailyData || dailyData.length < 4) {
            console.log(`⚠️ 天气数据不足: 只有 ${dailyData ? dailyData.length : 0} 天数据`);
            // 如果没有足够的数据，至少显示可用的天数
            if (dailyData && dailyData.length >= 2) {
                // 显示可用的天数（从明天开始）
                const availableDays = Math.min(3, dailyData.length - 1);
                console.log(`📊 显示可用的 ${availableDays} 天预报`);
                
                // 获取可用天数的预报
                const futureDays = [];
                for (let i = 1; i <= availableDays; i++) {
                    const day = dailyData[i];
                    const dayMaxTemp = Math.round(day.tempMax);
                    const dayMinTemp = Math.round(day.tempMin);
                    const dayWeatherDay = day.textDay;
                    const dayWeatherNight = day.textNight;
                    
                    // 获取日期和星期几
                    const dayDate = new Date(day.fxDate);
                    const dayMonth = dayDate.getMonth() + 1;
                    const dayDay = dayDate.getDate();
                    const dayWeekday = getWeekday(dayDate.getDay());
                    
                    futureDays.push({
                        date: `${dayMonth}月${dayDay}日`,
                        weekday: dayWeekday,
                        weatherDay: dayWeatherDay,
                        weatherNight: dayWeatherNight,
                        minTemp: dayMinTemp,
                        maxTemp: dayMaxTemp
                    });
                }
                
                // 获取明天天气图标
                const tomorrowIconDay = dailyData[1]?.iconDay;
                const tomorrowIconUrl = getHeWeatherIcon(tomorrowIconDay);
                
                const title = "📅 明日及未来预报";
                const subtitle = `📍${province}${city}${district}`;
                
                let body = "";
                
                // 显示可用的天数预报
                for (let i = 0; i < futureDays.length; i++) {
                    const day = futureDays[i];
                    const dayEmojiDay = getWeatherEmoji(day.weatherDay);
                    const dayEmojiNight = getWeatherEmoji(day.weatherNight);
                    
                    body += `${day.date}（${day.weekday}）\n`;
                    body += `🌞 白天: ${dayEmojiDay}${day.weatherDay}\n`;
                    body += `🌙 夜间: ${dayEmojiNight}${day.weatherNight}\n`;
                    body += `🌡️ 气温: ${day.minTemp}℃~${day.maxTemp}℃\n`;
                    
                    if (i < futureDays.length - 1) {
                        body += "────────────\n";
                    }
                }
                
                if (futureDays.length < 3) {
                    body += `\n⚠️ 只获取到 ${futureDays.length} 天预报数据`;
                }
                
                console.log("✅ 准备发送明日及未来天气预报");
                
                // 发送通知
                $notification.post(title, subtitle, body, {
                    "icon": tomorrowIconUrl
                });
                return;
            } else {
                throw new Error(`天气数据不足，无法获取未来三天预报。只有 ${dailyData ? dailyData.length : 0} 天数据`);
            }
        }
        
        // 获取未来三天天气信息（跳过今天，取明天、后天、大后天）
        const futureDays = [];
        const startIndex = 1; // 从明天开始
        const endIndex = startIndex + 3; // 取三天
        
        for (let i = startIndex; i < endIndex; i++) {
            const day = dailyData[i];
            const dayMaxTemp = Math.round(day.tempMax);
            const dayMinTemp = Math.round(day.tempMin);
            const dayWeatherDay = day.textDay;
            const dayWeatherNight = day.textNight;
            const dayIconDay = day.iconDay;
            
            // 获取日期和星期几
            const dayDate = new Date(day.fxDate);
            const dayMonth = dayDate.getMonth() + 1;
            const dayDay = dayDate.getDate();
            const dayWeekday = getWeekday(dayDate.getDay());
            
            futureDays.push({
                date: `${dayMonth}月${dayDay}日`,
                weekday: dayWeekday,
                weatherDay: dayWeatherDay,
                weatherNight: dayWeatherNight,
                minTemp: dayMinTemp,
                maxTemp: dayMaxTemp,
                iconDay: dayIconDay
            });
        }
        
        // 获取明天天气图标（使用和风天气官方图标）
        const tomorrowIconUrl = getHeWeatherIcon(futureDays[0].iconDay);
        
        const title = "📅 未来三天天气预报";
        const subtitle = `📍${province}${city}${district}`;
        
        let body = "";
        
        // 显示未来三天预报
        for (let i = 0; i < futureDays.length; i++) {
            const day = futureDays[i];
            const dayEmojiDay = getWeatherEmoji(day.weatherDay);
            const dayEmojiNight = getWeatherEmoji(day.weatherNight);
            
            body += `${day.date}（${day.weekday}）\n`;
            body += `🌞 白天: ${dayEmojiDay}${day.weatherDay}\n`;
            body += `🌙 夜间: ${dayEmojiNight}${day.weatherNight}\n`;
            body += `🌡️ 气温: ${day.minTemp}℃~${day.maxTemp}℃\n`;
            
            if (i < futureDays.length - 1) {
                body += "────────────\n";
            }
        }
        
        console.log("✅ 准备发送明日及未来三天天气预报");
        
        // 发送通知
        $notification.post(title, subtitle, body, {
            "icon": tomorrowIconUrl
        });
        
    } catch (e) {
        handleError("明日天气数据处理失败", e.message);
    }
}

// === 在日志中记录生活指数 ===
function logLivingIndices(indices, targetDate, province, city, district) {
    try {
        // 定义指数类型映射
        const indexTypeMap = {
            "1": { name: "运动指数", emoji: "🏃" },
            "2": { name: "洗车指数", emoji: "🚗" },
            "3": { name: "穿衣指数", emoji: "👕" },
            "4": { name: "钓鱼指数", emoji: "🎣" },
            "5": { name: "紫外线指数", emoji: "☀️" },
            "6": { name: "旅游指数", emoji: "✈️" },
            "7": { name: "过敏指数", emoji: "🤧" },
            "8": { name: "舒适度指数", emoji: "😌" },
            "9": { name: "感冒指数", emoji: "🤒" },
            "10": { name: "空气污染扩散条件指数", emoji: "🏭" },
            "11": { name: "空调开启指数", emoji: "❄️" },
            "12": { name: "太阳镜指数", emoji: "🕶️" },
            "13": { name: "化妆指数", emoji: "💄" },
            "14": { name: "晾晒指数", emoji: "👕" },
            "15": { name: "交通指数", emoji: "🚦" },
            "16": { name: "防晒指数", emoji: "🧴" }
        };
        
        // 按类型ID排序
        const sortedIndices = indices.sort((a, b) => {
            return parseInt(a.type) - parseInt(b.type);
        });
        
        // 格式化日期
        const dateObj = new Date(targetDate);
        const weekday = getWeekday(dateObj.getDay());
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        const formattedDate = `${month}月${day}日 (${weekday})`;
        
        console.log("\n" + "=".repeat(50));
        console.log("📊 明日全部生活指数 - " + formattedDate);
        console.log("📍 " + province + city + district);
        console.log("=".repeat(50));
        
        // 记录每个生活指数
        sortedIndices.forEach((index, i) => {
            const indexInfo = indexTypeMap[index.type] || { name: "未知指数", emoji: "❓" };
            console.log(`\n${indexInfo.emoji} ${indexInfo.name} (类型${index.type})`);
            console.log(`   等级: ${index.category} (${index.level}级)`);
            if (index.text && index.text.trim()) {
                console.log(`   描述: ${index.text}`);
            }
        });
        
        console.log("\n" + "=".repeat(50));
        console.log(`✅ 共获取 ${sortedIndices.length} 个生活指数`);
        console.log("=".repeat(50) + "\n");
        
        // 结束脚本
        $done();
        
    } catch (e) {
        console.log("❌ 生活指数记录失败:", e.message);
        logDefaultLivingIndices(province, city, district, targetDate);
    }
}

// === 记录默认生活指数到日志（当API失败时使用） ===
function logDefaultLivingIndices(province, city, district, targetDate) {
    try {
        // 格式化日期
        const dateObj = targetDate ? new Date(targetDate) : new Date();
        const weekday = getWeekday(dateObj.getDay());
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        const formattedDate = `${month}月${day}日 (${weekday})`;
        
        console.log("\n" + "=".repeat(50));
        console.log("📊 生活指数获取失败 - 显示默认值");
        console.log("📍 " + province + city + district + " " + formattedDate);
        console.log("=".repeat(50));
        console.log("\n⚠️ 生活指数数据获取失败，API可能暂时不可用");
        console.log("=".repeat(50) + "\n");
        
        // 结束脚本
        $done();
        
    } catch (e) {
        console.log("❌ 默认生活指数记录失败:", e.message);
        $done();
    }
}

// === 辅助函数 ===

// 检查是否是22:17及之后
function isLastRunTime() {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    // 22:17及之后返回true
    return hour > 22 || (hour === 22 && minute >= 17);
}

// 获取当前时间字符串
function getCurrentTime() {
    const now = new Date();
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');
    return `${hour}:${minute}:${second}`;
}

// 获取和风天气官方图标（根据图标代码）
function getHeWeatherIcon(iconCode) {
    // 和风天气官方图标URL格式：https://cdn.heweather.com/cond_icon/{iconCode}.png
    // 例如：https://cdn.heweather.com/cond_icon/100.png
    if (iconCode) {
        return `https://cdn.heweather.com/cond_icon/${iconCode}.png`;
    }
    return "https://cdn.heweather.com/cond_icon/100.png"; // 默认晴天图标
}

// 获取天气Emoji
function getWeatherEmoji(weatherText) {
    if (!weatherText) return "🌤️";
    
    if (weatherText.includes("晴")) {
        return "☀️";
    } else if (weatherText.includes("多云")) {
        return "⛅";
    } else if (weatherText.includes("阴")) {
        return "☁️";
    } else if (weatherText.includes("雨")) {
        if (weatherText.includes("雷阵雨")) {
            return "⛈️";
        } else if (weatherText.includes("小雨")) {
            return "🌦️";
        } else if (weatherText.includes("中雨") || weatherText.includes("大雨")) {
            return "🌧️";
        } else if (weatherText.includes("暴雨")) {
            return "⛈️";
        }
        return "🌧️";
    } else if (weatherText.includes("雪")) {
        if (weatherText.includes("小雪")) {
            return "🌨️";
        } else if (weatherText.includes("中雪") || weatherText.includes("大雪")) {
            return "❄️";
        } else if (weatherText.includes("暴雪")) {
            return "🌨️❄️";
        }
        return "❄️";
    } else if (weatherText.includes("雾") || weatherText.includes("霾")) {
        return "🌫️";
    } else if (weatherText.includes("沙尘")) {
        return "🌪️";
    }
    return "🌤️";
}

// 天行数据天气类型映射
function getTianapiWeatherTypeFromText(text) {
    if (text.includes("晴")) return 9;
    if (text.includes("多云")) return 2;
    if (text.includes("阴")) return 10;
    if (text.includes("雨")) return 3;
    if (text.includes("雪")) return 4;
    if (text.includes("雾") || text.includes("霾")) return 7;
    if (text.includes("风")) return 1;
    return null;
}

// 获取星期几
function getWeekday(day) {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return weekdays[day];
}

// 错误处理
function handleError(title, message) {
    console.error(`❌ 错误: ${title} - ${message}`);
    $notification.post("❌ " + title, message, "");
    $done();
}

// === 启动脚本 ===
main();