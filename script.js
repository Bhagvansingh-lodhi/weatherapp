// API Key for OpenWeatherMap (replace with your own API key)
const API_KEY = "f1961a9985ddc898a4eabcbf29db6d96";

// DOM Elements
const cityInput = document.querySelector('.city-input');
const searchBtn = document.querySelector('.search-btn');
const locationBtn = document.querySelector('.location-btn');
const unitButtons = document.querySelectorAll('.unit-btn');
const currentWeatherSection = document.querySelector('.current-weather');
const forecastSection = document.querySelector('.days-forecast');
const historyList = document.querySelector('.history-list');

// Global variables
let currentUnit = 'celsius';
let searchHistory = JSON.parse(localStorage.getItem('weatherSearchHistory')) || [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Set current date
    updateDate();
    
    // Load search history
    renderSearchHistory();
    
    // Check if there's a last searched city in local storage
    const lastCity = localStorage.getItem('lastSearchedCity');
    if (lastCity) {
        getWeatherData(lastCity);
    } else {
        // Default city on first load
        getWeatherData('London');
    }
    
    // Event listeners
    searchBtn.addEventListener('click', handleSearch);
    cityInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') handleSearch();
    });
    
    locationBtn.addEventListener('click', getCurrentLocationWeather);
    
    unitButtons.forEach(button => {
        button.addEventListener('click', function() {
            const unit = this.dataset.unit;
            if (unit !== currentUnit) {
                switchUnit(unit);
            }
        });
    });
});

// Handle search functionality
function handleSearch() {
    const city = cityInput.value.trim();
    if (city) {
        getWeatherData(city);
        cityInput.value = '';
    }
}

// Get weather data for a city
function getWeatherData(city) {
    showLoading('current');
    
    // Save as last searched city
    localStorage.setItem('lastSearchedCity', city);
    
    // Fetch current weather
    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`)
        .then(response => {
            if (!response.ok) {
                throw new Error('City not found');
            }
            return response.json();
        })
        .then(data => {
            displayCurrentWeather(data);
            addToSearchHistory(city);
            
            // Fetch forecast data using coordinates from current weather
            return fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${data.coord.lat}&lon=${data.coord.lon}&appid=${API_KEY}&units=metric`);
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Forecast data unavailable');
            }
            return response.json();
        })
        .then(data => {
            displayForecast(data);
            hideLoading('current');
            hideLoading('forecast');
        })
        .catch(error => {
            hideLoading('current');
            hideLoading('forecast');
            showError('current', error.message);
            console.error('Error:', error);
        });
}

// Get weather by current location
function getCurrentLocationWeather() {
    if (!navigator.geolocation) {
        showError('current', 'Geolocation is not supported by your browser');
        return;
    }
    
    showLoading('current');
    
    navigator.geolocation.getCurrentPosition(
        position => {
            const { latitude, longitude } = position.coords;
            
            // Fetch weather by coordinates
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Location not found');
                    }
                    return response.json();
                })
                .then(data => {
                    displayCurrentWeather(data);
                    addToSearchHistory(data.name);
                    
                    // Fetch forecast
                    return fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`);
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Forecast data unavailable');
                    }
                    return response.json();
                })
                .then(data => {
                    displayForecast(data);
                    hideLoading('current');
                    hideLoading('forecast');
                })
                .catch(error => {
                    hideLoading('current');
                    hideLoading('forecast');
                    showError('current', error.message);
                    console.error('Error:', error);
                });
        },
        error => {
            hideLoading('current');
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    showError('current', 'Location access denied');
                    break;
                case error.POSITION_UNAVAILABLE:
                    showError('current', 'Location information unavailable');
                    break;
                case error.TIMEOUT:
                    showError('current', 'Location request timed out');
                    break;
                default:
                    showError('current', 'An unknown error occurred');
                    break;
            }
        }
    );
}

// Display current weather data
function displayCurrentWeather(data) {
    const {
        name: city,
        sys: { country },
        main: { temp, feels_like, humidity, pressure },
        weather: [{ description, icon }],
        wind: { speed }
    } = data;
    
    // Update city information
    document.querySelector('.city-name').textContent = city;
    document.querySelector('.city-country').textContent = country;
    
    // Update temperature and description
    updateTemperature(temp);
    document.querySelector('.weather-description').textContent = description;
    
    // Update weather icon
    const weatherIcon = document.querySelector('.weather-icon');
    weatherIcon.innerHTML = `<img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${description}">`;
    
    // Update other details
    document.querySelector('.feels-like').textContent = `${convertTemperature(feels_like)}°${currentUnit === 'celsius' ? 'C' : 'F'}`;
    document.querySelector('.wind').textContent = `${speed} m/s`;
    document.querySelector('.humidity').textContent = `${humidity}%`;
    document.querySelector('.pressure').textContent = `${pressure} hPa`;
    
    // Update background based on weather condition
    updateBackground(icon);
    
    // Hide any error messages
    hideError('current');
}

// Display 5-day forecast
function displayForecast(data) {
    const forecastContainer = document.querySelector('.weather-cards');
    forecastContainer.innerHTML = '';
    
    // Filter to get one forecast per day (around noon)
    const dailyForecasts = data.list.filter(forecast => {
        return forecast.dt_txt.includes('12:00:00');
    }).slice(0, 5);
    
    dailyForecasts.forEach(day => {
        const {
            dt_txt: date,
            main: { temp },
            weather: [{ description, icon }],
            wind: { speed },
            main: { humidity }
        } = day;
        
        const forecastDate = new Date(date);
        const dayName = forecastDate.toLocaleDateString('en-US', { weekday: 'short' });
        const formattedDate = forecastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const forecastCard = document.createElement('li');
        forecastCard.classList.add('card');
        forecastCard.innerHTML = `
            <h3 class="forecast-date">${dayName}<br>${formattedDate}</h3>
            <div class="forecast-icon">
                <img src="https://openweathermap.org/img/wn/${icon}.png" alt="${description}">
            </div>
            <h6 class="forecast-temp">Temp: ${convertTemperature(temp)}°${currentUnit === 'celsius' ? 'C' : 'F'}</h6>
            <h6 class="forecast-wind">Wind: ${speed} M/S</h6>
            <h6 class="forecast-humidity">Humidity: ${humidity}%</h6>
        `;
        
        forecastContainer.appendChild(forecastCard);
    });
    
    // Hide any error messages
    hideError('forecast');
}

// Add city to search history
function addToSearchHistory(city) {
    // Avoid duplicates
    if (!searchHistory.includes(city)) {
        searchHistory.unshift(city);
        
        // Keep only the last 5 searches
        if (searchHistory.length > 5) {
            searchHistory.pop();
        }
        
        // Save to localStorage
        localStorage.setItem('weatherSearchHistory', JSON.stringify(searchHistory));
        
        // Update UI
        renderSearchHistory();
    }
}

// Render search history
function renderSearchHistory() {
    historyList.innerHTML = '';
    
    searchHistory.forEach(city => {
        const historyItem = document.createElement('div');
        historyItem.classList.add('history-item');
        historyItem.textContent = city;
        
        historyItem.addEventListener('click', () => {
            getWeatherData(city);
        });
        
        historyList.appendChild(historyItem);
    });
}

// Switch between Celsius and Fahrenheit
function switchUnit(unit) {
    currentUnit = unit;
    
    // Update active button
    unitButtons.forEach(button => {
        if (button.dataset.unit === unit) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    // Convert all temperatures
    const tempElements = document.querySelectorAll('.temperature, .feels-like, .forecast-temp');
    tempElements.forEach(element => {
        if (element.textContent.includes('°')) {
            const currentTemp = parseFloat(element.textContent);
            const convertedTemp = convertTemperature(currentTemp, true);
            if (element.classList.contains('temperature')) {
                element.textContent = `${convertedTemp}°${unit === 'celsius' ? 'C' : 'F'}`;
            } else if (element.classList.contains('feels-like')) {
                element.textContent = `${convertedTemp}°${unit === 'celsius' ? 'C' : 'F'}`;
            } else {
                element.textContent = element.textContent.replace(/-?\d+°[CF]/, `${convertedTemp}°${unit === 'celsius' ? 'C' : 'F'}`);
            }
        }
    });
}

// Convert temperature between Celsius and Fahrenheit
function convertTemperature(temp, isConversion = false) {
    if (isConversion) {
        // We're converting an already displayed temperature
        if (currentUnit === 'celsius') {
            // Convert from Fahrenheit to Celsius
            return Math.round((temp - 32) * 5/9);
        } else {
            // Convert from Celsius to Fahrenheit
            return Math.round((temp * 9/5) + 32);
        }
    } else {
        // We're converting from API data
        if (currentUnit === 'celsius') {
            return Math.round(temp);
        } else {
            return Math.round((temp * 9/5) + 32);
        }
    }
}

// Update temperature display
function updateTemperature(temp) {
    const temperatureElement = document.querySelector('.temperature');
    temperatureElement.textContent = `${convertTemperature(temp)}°${currentUnit === 'celsius' ? 'C' : 'F'}`;
}

// Update background based on weather condition
function updateBackground(iconCode) {
    const weatherAnimation = document.getElementById('weather-animation');
    
    // Clear previous animation
    weatherAnimation.innerHTML = '';
    
    // Determine weather type from icon code
    let weatherType = 'default';
    if (iconCode.includes('01')) weatherType = 'clear';
    else if (iconCode.includes('02') || iconCode.includes('03') || iconCode.includes('04')) weatherType = 'clouds';
    else if (iconCode.includes('09') || iconCode.includes('10')) weatherType = 'rain';
    else if (iconCode.includes('11')) weatherType = 'thunderstorm';
    else if (iconCode.includes('13')) weatherType = 'snow';
    else if (iconCode.includes('50')) weatherType = 'mist';
    
    // Add appropriate animation elements
    const animationElement = document.createElement('div');
    animationElement.classList.add('weather-type', weatherType);
    
    switch(weatherType) {
        case 'clear':
            animationElement.innerHTML = `
                <div class="sun"></div>
                <div class="ray ray-1"></div>
                <div class="ray ray-2"></div>
                <div class="ray ray-3"></div>
                <div class="ray ray-4"></div>
            `;
            break;
        case 'clouds':
            animationElement.innerHTML = `
                <div class="cloud cloud-1"></div>
                <div class="cloud cloud-2"></div>
                <div class="cloud cloud-3"></div>
            `;
            break;
        case 'rain':
            animationElement.innerHTML = `
                <div class="cloud"></div>
                <div class="rain">
                    <div class="drop"></div>
                    <div class="drop"></div>
                    <div class="drop"></div>
                    <div class="drop"></div>
                    <div class="drop"></div>
                </div>
            `;
            break;
        case 'thunderstorm':
            animationElement.innerHTML = `
                <div class="cloud"></div>
                <div class="lightning">
                    <div class="bolt"></div>
                </div>
            `;
            break;
        case 'snow':
            animationElement.innerHTML = `
                <div class="snowflake"></div>
                <div class="snowflake"></div>
                <div class="snowflake"></div>
                <div class="snowflake"></div>
                <div class="snowflake"></div>
            `;
            break;
        case 'mist':
            animationElement.innerHTML = `
                <div class="mist"></div>
            `;
            break;
        default:
            animationElement.innerHTML = `
                <div class="cloud"></div>
                <div class="sun"></div>
            `;
    }
    
    weatherAnimation.appendChild(animationElement);
}

// Update current date
function updateDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.querySelector('.current-date').textContent = now.toLocaleDateString('en-US', options);
}

// Show loading spinner
function showLoading(type) {
    const loadingElement = document.getElementById(`${type}-weather-loading`);
    if (loadingElement) {
        loadingElement.style.display = 'flex';
    }
}

// Hide loading spinner
function hideLoading(type) {
    const loadingElement = document.getElementById(`${type}-weather-loading`);
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

// Show error message
function showError(type, message) {
    const errorElement = document.getElementById(`${type}-weather-error`);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// Hide error message
function hideError(type) {
    const errorElement = document.getElementById(`${type}-weather-error`);
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

// Add CSS for weather animations
const style = document.createElement('style');
style.textContent = `
    /* Weather animations */
    .weather-type {
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
    }
    
    /* Sun animation */
    .sun {
        position: absolute;
        top: 50px;
        right: 100px;
        width: 60px;
        height: 60px;
        background: #ffdd00;
        border-radius: 50%;
        box-shadow: 0 0 50px #ffdd00, 0 0 100px #ffaa00;
        animation: pulse 2s infinite;
    }
    
    .ray {
        position: absolute;
        top: 50px;
        right: 100px;
        width: 80px;
        height: 3px;
        background: #ffdd00;
        transform-origin: 100% 50%;
    }
    
    .ray-1 { transform: rotate(0deg); }
    .ray-2 { transform: rotate(45deg); }
    .ray-3 { transform: rotate(90deg); }
    .ray-4 { transform: rotate(135deg); }
    
    /* Cloud animation */
    .cloud {
        position: absolute;
        background: white;
        border-radius: 50%;
        opacity: 0.7;
    }
    
    .cloud:before,
    .cloud:after {
        content: '';
        position: absolute;
        background: white;
        border-radius: 50%;
    }
    
    .cloud-1 {
        width: 80px;
        height: 40px;
        top: 50px;
        left: 100px;
        animation: moveCloud 20s linear infinite;
    }
    
    .cloud-1:before {
        width: 40px;
        height: 40px;
        top: -20px;
        left: 10px;
    }
    
    .cloud-1:after {
        width: 50px;
        height: 50px;
        top: -25px;
        right: 10px;
    }
    
    .cloud-2 {
        width: 60px;
        height: 30px;
        top: 100px;
        right: 150px;
        animation: moveCloud 25s linear infinite reverse;
    }
    
    .cloud-3 {
        width: 70px;
        height: 35px;
        top: 150px;
        left: 200px;
        animation: moveCloud 30s linear infinite;
    }
    
    @keyframes moveCloud {
        0% { transform: translateX(0); }
        100% { transform: translateX(calc(100vw - 200px)); }
    }
    
    /* Rain animation */
    .rain {
        position: absolute;
        width: 100%;
        height: 100%;
    }
    
    .drop {
        position: absolute;
        width: 2px;
        height: 15px;
        background: rgba(255, 255, 255, 0.7);
        border-radius: 0 0 5px 5px;
        animation: rainFall linear infinite;
    }
    
    .drop:nth-child(1) { left: 10%; animation-duration: 1s; animation-delay: 0s; }
    .drop:nth-child(2) { left: 30%; animation-duration: 1.2s; animation-delay: 0.3s; }
    .drop:nth-child(3) { left: 50%; animation-duration: 0.9s; animation-delay: 0.6s; }
    .drop:nth-child(4) { left: 70%; animation-duration: 1.1s; animation-delay: 0.2s; }
    .drop:nth-child(5) { left: 90%; animation-duration: 1.3s; animation-delay: 0.5s; }
    
    @keyframes rainFall {
        0% { top: -10px; opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { top: 100vh; opacity: 0; }
    }
    
    /* Snow animation */
    .snowflake {
        position: absolute;
        background: white;
        border-radius: 50%;
        opacity: 0.8;
        animation: snowFall linear infinite;
    }
    
    .snowflake:nth-child(1) { 
        width: 6px; height: 6px; left: 10%; animation-duration: 10s; 
        animation-delay: 0s; 
    }
    .snowflake:nth-child(2) { 
        width: 8px; height: 8px; left: 30%; animation-duration: 12s; 
        animation-delay: 2s; 
    }
    .snowflake:nth-child(3) { 
        width: 5px; height: 5px; left: 50%; animation-duration: 14s; 
        animation-delay: 1s; 
    }
    .snowflake:nth-child(4) { 
        width: 7px; height: 7px; left: 70%; animation-duration: 11s; 
        animation-delay: 3s; 
    }
    .snowflake:nth-child(5) { 
        width: 6px; height: 6px; left: 90%; animation-duration: 13s; 
        animation-delay: 1.5s; 
    }
    
    @keyframes snowFall {
        0% { 
            top: -10px; 
            transform: translateX(0) rotate(0deg); 
        }
        100% { 
            top: 100vh; 
            transform: translateX(50px) rotate(360deg); 
        }
    }
    
    /* Mist animation */
    .mist {
        position: absolute;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.1);
        animation: mistMove 5s ease-in-out infinite alternate;
    }
    
    @keyframes mistMove {
        0% { opacity: 0.1; }
        100% { opacity: 0.3; }
    }
    
    /* Lightning animation */
    .lightning {
        position: absolute;
        width: 100%;
        height: 100%;
    }
    
    .bolt {
        position: absolute;
        top: 0;
        left: 50%;
        width: 4px;
        height: 0;
        background: rgba(255, 255, 255, 0.8);
        box-shadow: 0 0 20px 5px rgba(255, 255, 255, 0.8);
        animation: lightning 4s linear infinite;
    }
    
    @keyframes lightning {
        0%, 95%, 100% { height: 0; opacity: 0; }
        5%, 90% { height: 100vh; opacity: 1; }
    }
`;
document.head.appendChild(style);
