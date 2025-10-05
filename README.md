# NASA Terra Hazard Map

A **React + Leaflet** web application that visualizes global **fire and flood risks** using real NASA Earthdata imagery (GIBS) and other public datasets.  
It also integrates real-time weather data and a multilingual **test emergency broadcast** feature powered by the Web Speech API.

---

## Features

### NASA GIBS Layers
- **MODIS Terra Corrected Reflectance (True Color)** — realistic Earth imagery  
- **MODIS Thermal Anomalies (Day/Night)** — detects active fire hotspots  
- **GPM IMERG Precipitation Rate** — real-time precipitation proxy for flood risk  
- **FEMA National Flood Hazard Layer** (U.S.) — flood-prone zones  

### Real-Time Weather
- Fetches live temperature, windspeed, and conditions for any map location using **Open-Meteo API**
- Displays localized time using browser locale and timezone data  

### Multilingual “Test Emergency” Speech
- On map click (when enabled), plays a “This is a test emergency” message in multiple major languages based on the clicked country’s common languages  
- Uses the **Web Speech Synthesis API**

### Interactive Map
- Built with **React Leaflet**
- Date selector for exploring past NASA imagery  
- Layer controls for fire and flood overlays  
- Ripple click animation  
- Lightweight and fully client-side  

---

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend Framework | React (Vite setup) |
| Mapping Library | Leaflet + React-Leaflet |
| Date Utilities | Day.js |
| Styling | Custom CSS |
| APIs | NASA GIBS, Open-Meteo, FEMA ArcGIS, OpenStreetMap (Nominatim) |
| Speech | Web Speech API (browser-based) |

---

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/nasa-terra-hazard-map.git
cd nasa-terra-hazard-map

### 2. Install Dependencies
npm install

### 3. Run the App
npm run dev
