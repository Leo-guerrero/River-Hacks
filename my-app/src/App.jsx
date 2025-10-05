import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { MapContainer, TileLayer, LayersControl, useMapEvents} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const { BaseLayer, Overlay } = LayersControl;

const GIBS_HOST = 'https://gibs-{s}.earthdata.nasa.gov';
const SUBDOMAINS = ['a','b','c'];
const TILEMATRIXSET = 'GoogleMapsCompatible_Level6';

// NASA layer IDs (GIBS)
const LAYERS = {
  TRUE_COLOR: 'MODIS_Terra_CorrectedReflectance_TrueColor',
  FIRE_DAY: 'MODIS_Terra_Thermal_Anomalies_Day',
  FIRE_NIGHT: 'MODIS_Terra_Thermal_Anomalies_Night',
  AOD: 'MODIS_Terra_Aerosol',
  // Flood risk proxies / products
  IMERG_RATE: 'IMERG_Precipitation_Rate', // precipitation proxy for flood risk
  // NOTE: NRT flood extent layers exist (MODIS/VIIRS “Global Flood Product”).
  // When exposed via GIBS WMTS for your environment, add the identifier here, e.g.:
  // FLOOD_NRT: 'MCDWD_Flood_1Day' (example name; replace with actual layer id when available)
};

function gibsUrl(layerId, date, ext = 'png') {
  const yyyyMMdd = dayjs(date).format('YYYY-MM-DD');
  return `${GIBS_HOST}/wmts/epsg3857/best/${layerId}/default/${yyyyMMdd}/${TILEMATRIXSET}/{z}/{y}/{x}.${ext}`;
}

// FEMA NFHL (U.S.-only) tiled map service (Web Mercator)
const FEMA_NFHL = 'https://tiles.arcgis.com/tiles/hGdibHYSPO59RG1h/arcgis/rest/services/FEMA_National_Flood_Hazard_Layer/MapServer/tile/{z}/{y}/{x}';

// --- TTS: translations for "THIS IS A TEST EMERGENCY"
const EMERGENCY_PHRASE = {
  en: "THIS IS A TEST EMERGENCY",
  es: "ESTA ES UNA EMERGENCIA DE PRUEBA",
  zh: "这是一条测试紧急通知",
  hi: "यह एक परीक्षण आपातकाल है",
  ar: "هذه حالة طوارئ تجريبية",
  fr: "Ceci est une alerte d’urgence de test",
  vi: "ĐÂY LÀ TÌNH HUỐNG KHẨN CẤP THỬ NGHIỆM",
  pt: "ISTO É UMA EMERGÊNCIA DE TESTE",
  ru: "ЭТО ТЕСТОВОЕ ЧРЕЗВЫЧАЙНОЕ СООБЩЕНИЕ",
  ja: "これはテスト緊急放送です",
  ko: "이것은 시험 비상 안내입니다",
  de: "DIES IST EINE TEST-NOTFALLMELDUNG",
  tl: "ITO AY ISANG PAGSUSUBOK NA EMERHENSIYA",  // Tagalog/Filipino
  ur: "یہ ایک آزمائشی ہنگامی صورتحال ہے",
  fa: "این یک وضعیت اضطراری آزمایشی است",
  tr: "BU BİR DENEME ACİL DURUMU",
  it: "QUESTO È UN’EMERGENZA DI PROVA",
  pl: "TO JEST TESTOWY ALARM",
  nl: "Dit is een test-noodmelding",
  pa: "ਇਹ ਇੱਕ ਟੈਸਟ ਐਮਰਜੈਂਸੀ ਹੈ",
  bn: "এটি একটি পরীক্ষামূলক জরুরি অবস্থা",
  ta: "இது ஒரு சோதனை அவசர நிலை",
  te: "ఇది ఒక పరీక్ష అత్యవసర పరిస్థితి",
  mr: "ही एक चाचणी आपत्कालीन स्थिती आहे",
};

// Top ~5 languages per country (very rough, demo purposes)
const COUNTRY_LANGS = {
  US: ["en","es","zh","vi","ar"],
  CA: ["en","fr","zh","pa","es"],
  MX: ["es","en","zh","fr","de"],
  BR: ["pt","en","es","fr","de"],
  GB: ["en","pl","pa","ur","ar"],
  AU: ["en","zh","it","vi","el"],
  IN: ["hi","en","bn","te","ta"],
  CN: ["zh","yue","en","ko","ru"],        // yue≈Cantonese; will fall back to zh
  JP: ["ja","en","zh","ko","pt"],
  KR: ["ko","en","zh","ja","vi"],
  FR: ["fr","en","es","ar","pt"],
  DE: ["de","en","tr","ru","pl"],
  ES: ["es","en","ca","gl","fr"],
  IT: ["it","en","fr","es","ro"],
  PT: ["pt","en","es","fr","uk"],
  RU: ["ru","en","uk","tt","az"],
  VN: ["vi","en","zh","fr","ko"],
  PH: ["tl","en","zh","es","ko"],
  TR: ["tr","en","ku","ar","fa"],
  IR: ["fa","az","ku","ps","en"],
  PK: ["ur","pa","sd","ps","en"],
  SA: ["ar","en","ur","fa","hi"],
  NG: ["en","yo","ig","ha","fr"],
};

// Pick a voice for a lang code (best-effort)
function pickVoiceFor(langCode, voices) {
  // Normalize: treat regional tags as startsWith
  const cand = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(langCode.toLowerCase()));
  if (cand.length) return cand[0];
  // Special cases / fallbacks
  if (langCode === "yue") return voices.find(v => v.lang?.startsWith("zh")) || null; // Cantonese -> zh
  if (langCode === "tl")  return voices.find(v => v.lang?.startsWith("fil")) || null; // Tagalog/Filipino
  return voices.find(v => v.lang?.startsWith("en")) || null;
}

async function reverseCountryCode(lat, lon) {
  // Nominatim reverse geocode (country only)
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=3&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "Accept": "application/json" }
  });
  const data = await res.json();
  return (data?.address?.country_code || "").toUpperCase(); // e.g., "US"
}

async function speakTestEmergencyAt(lat, lon) {
  const synth = window.speechSynthesis;
  if (!synth) {
    alert("Speech Synthesis not supported in this browser.");
    return;
  }

  // Ensure voices are loaded (Chrome quirk)
  await new Promise(resolve => {
    let tries = 0;
    const waitVoices = () => {
      const voices = synth.getVoices();
      if (voices.length || tries++ > 10) resolve();
      else setTimeout(waitVoices, 200);
    };
    waitVoices();
  });

  const voices = synth.getVoices();
  const cc = await reverseCountryCode(lat, lon);
  const langs = (COUNTRY_LANGS[cc] || ["en","es","fr","ar","zh"]).slice(0, 5);

  // Queue up to 5 utterances
  langs.forEach(code => {
    const text = EMERGENCY_PHRASE[code] || EMERGENCY_PHRASE.en;
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoiceFor(code, voices);
    if (voice) u.voice = voice;
    // Slight pacing
    u.rate = 0.95;
    u.pitch = 1.0;
    synth.speak(u);
  });
}

function MapClickHandler({ enabled }) {
  useMapEvents({
    click: async (e) => {
      if (!enabled) return;
      const { lat, lng } = e.latlng;
      await speakTestEmergencyAt(lat, lng);
    }
  });
  return null;
}

function ClickRippleLayer({ onClickAtPx, speakEnabled, onClickLatLng }) {
  useMapEvents({
    click: async (e) => {
      onClickAtPx(e.containerPoint.x, e.containerPoint.y);
      if (onClickLatLng) onClickLatLng(e.latlng.lat, e.latlng.lng);
      if (speakEnabled) {
        const { lat, lng } = e.latlng;
        await speakTestEmergencyAt(lat, lng);
      }
    }
  });
  return null;
}

// Weather code → text (Open-Meteo WMO)
const WX = {
  0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  56: "Freezing drizzle", 57: "Freezing drizzle+",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  66: "Freezing rain", 67: "Freezing rain+",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Light showers", 81: "Showers", 82: "Heavy showers",
  85: "Snow showers", 86: "Snow showers+",
  95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Thunderstorm w/ heavy hail",
};

async function reversePlace(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const data = await res.json();
  const a = data?.address || {};
  const city = a.city || a.town || a.village || a.hamlet || a.county || "";
  const state = a.state || a.region || "";
  const cc = (a.country_code || "").toUpperCase();
  const placeName = [city, state, cc].filter(Boolean).join(", ");
  return { placeName, cc };
}

async function fetchWeather(lat, lon) {
  // Open-Meteo: current weather + auto timezone (no key)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
  const res = await fetch(url);
  const j = await res.json();
  const cw = j.current_weather || {};
  return {
    temperature: cw.temperature,          // °C
    windspeed: cw.windspeed,              // km/h
    weathercode: cw.weathercode,          // WMO code
    timezone: j.timezone || "UTC",
  };
}

// Simple weather info card
function WeatherInfoCard({ box, onClose }) {
  if (!box) return null;
  const { loading, error, placeName, temperature, windspeed, weathercode, timezone, clickedAt } = box;

  const timeStr = timezone
    ? new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(clickedAt || new Date())
    : new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" }).format(clickedAt || new Date());

  return (
    <div style={{
      position: "absolute", top: 10, left: 10, zIndex: 600,
      background: "white", border: "1px solid #ddd", borderRadius: 10,
      padding: "10px 12px", boxShadow: "0 4px 16px rgba(0,0,0,.12)", minWidth: 220
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <strong style={{ fontSize: 14 }}>Local Weather</strong>
        <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>✕</button>
      </div>
      {loading && <div style={{ fontSize: 12, color: "#666" }}>Loading…</div>}
      {error && <div style={{ fontSize: 12, color: "#b00020" }}>{error}</div>}
      {!loading && !error && (
        <div style={{ fontSize: 13, lineHeight: 1.35 }}>
          <div style={{ marginBottom: 4, color: "#333" }}>{placeName || "Selected location"}</div>
          <div style={{ marginBottom: 6, color: "#555" }}>Local time: <b>{timeStr}</b></div>
          <div>Temp: <b>{Math.round(temperature)}°C</b></div>
          <div>Wind: <b>{Math.round(windspeed)} km/h</b></div>
          <div>Conditions: <b>{WX[weathercode] || "—"}</b></div>
          <div style={{ marginTop: 6, fontSize: 11, color: "#777" }}>Powered by Open-Meteo</div>
        </div>
      )}
    </div>
  );
}


export default function App() {
  const [date, setDate] = useState(dayjs().subtract(1, 'day').format('YYYY-MM-DD'));
  const [testMode, setTestMode] = useState(false);
  const [filters, setFilters] = useState({ burning: true, flooding: true });
  const center = useMemo(() => [30.2672, -97.7431], []);
  const [ripples, setRipples] = useState([]);
  const [weatherBox, setWeatherBox] = useState(null);

  const addRipple = (x, y) => {
    const id = Math.random().toString(36).slice(2);
    setRipples(rs => [...rs, { id, x, y }]);
    // remove after animation completes
    setTimeout(() => setRipples(rs => rs.filter(r => r.id !== id)), 750);
  };
  const handleWeatherClick = async (lat, lon) => {
  setWeatherBox({ loading: true, clickedAt: new Date() });
  try {
    const [place, w] = await Promise.all([reversePlace(lat, lon), fetchWeather(lat, lon)]);
    setWeatherBox({
      loading: false,
      placeName: place.placeName,
      temperature: w.temperature,
      windspeed: w.windspeed,
     weathercode: w.weathercode,
      timezone: w.timezone,
      clickedAt: new Date(),
        });
      } catch (e) {
        setWeatherBox({ loading: false, error: "Couldn’t fetch weather right now." });
      }
    };

  return (
    <div style={{height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column'}}>
      {/* Top bar */}
      <div style={{padding: 8, display: 'flex', gap: 16, alignItems: 'center', background: '#f7f7f7', borderBottom: '1px solid #ddd'}}>
        <strong>NASA Terra Hazard Map</strong>
        <label> Date:&nbsp;
          <input
            type="date"
            value={date}
            max={dayjs().format('YYYY-MM-DD')}
            onChange={e => setDate(e.target.value)}
          />
        </label>

        {/* Risk Type filter */}
        <div style={{marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center'}}>
          <button
            onClick={() => setTestMode(t => !t)}
            style={{
              marginLeft: 12,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #bbb',
              background: testMode ? '#ffe8e8' : '#fff'
            }}
            title="When enabled, clicking the map will speak a test emergency in common local languages."
          >
            {testMode ? '✓ Test Emergency ON' : 'Test Emergency'}
          </button>

          <span style={{fontSize: 12, color: '#555'}}>Risk Type:</span>
          <label style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <input
              type="checkbox"
              checked={filters.burning}
              onChange={() => setFilters(f => ({...f, burning: !f.burning}))}
            /> Burning
          </label>
          <label style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <input
              type="checkbox"
              checked={filters.flooding}
              onChange={() => setFilters(f => ({...f, flooding: !f.flooding}))}
            /> Flooding
          </label>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* scoped CSS for ripple */}
          <style>{`
          .ripple-layer { position:absolute; inset:0; pointer-events:none; z-index: 500; }
          .ripple {
            position:absolute; width:14px; height:14px; border-radius:9999px;
            border:2px solid #1976d2; opacity:.8; transform:translate(-50%,-50%) scale(0);
            animation: rl-ripple 700ms ease-out forwards;
          }
          @keyframes rl-ripple {
            to { transform:translate(-50%,-50%) scale(8); opacity:0; }
          }
         `}</style>

        <MapContainer
          center={center}
          zoom={5}
          style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}  // pointer cursor
          zoomControl={false}
        >
           <ClickRippleLayer
             onClickAtPx={addRipple}
             speakEnabled={testMode}
            onClickLatLng={handleWeatherClick}
           />

          <LayersControl position="topright">
            {/* Base maps */}
            <BaseLayer checked name="OpenStreetMap">
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </BaseLayer>

            <BaseLayer name="Terra True Color (MODIS)">
              <TileLayer
                url={gibsUrl(LAYERS.TRUE_COLOR, date, 'jpg')}
                subdomains={SUBDOMAINS}
                attribution='Imagery: NASA EOSDIS GIBS'
                tileSize={256}
                crossOrigin
                maxNativeZoom={9}  // True Color supports Level9
                maxZoom={9}
                errorTileUrl="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
              />
            </BaseLayer>

            {/* BURNING group */}
            {filters.burning && (
              <>
                <Overlay checked name="Fires: Thermal Anomalies (Day)">
                  <TileLayer
                    url={gibsUrl(LAYERS.FIRE_DAY, date, 'png')}
                    subdomains={SUBDOMAINS}
                    opacity={0.9}
                    attribution='Fires (Terra/MODIS): NASA EOSDIS GIBS'
                    tileSize={256}
                    crossOrigin
                    maxNativeZoom={6}
                    maxZoom={6}
                    errorTileUrl="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
                  />
                </Overlay>
                <Overlay name="Fires: Thermal Anomalies (Night)">
                  <TileLayer
                    url={gibsUrl(LAYERS.FIRE_NIGHT, date, 'png')}
                    subdomains={SUBDOMAINS}
                    opacity={0.9}
                    attribution='Fires (Terra/MODIS): NASA EOSDIS GIBS'
                    tileSize={256}
                    crossOrigin
                    maxNativeZoom={6}
                    maxZoom={6}
                    errorTileUrl="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
                  />
                </Overlay>
              </>
            )}

            {/* FLOODING group */}
            {filters.flooding && (
              <>
                <Overlay checked name="Precipitation Rate (IMERG)">
                  <TileLayer
                    url={gibsUrl(LAYERS.IMERG_RATE, date, 'png')}
                    subdomains={SUBDOMAINS}
                    opacity={0.6}
                    attribution='GPM IMERG Precipitation Rate: NASA EOSDIS GIBS'
                    tileSize={256}
                    crossOrigin
                    maxNativeZoom={6}
                    maxZoom={6}
                  />
                </Overlay>

                <Overlay name="FEMA Flood Hazard Zones (US)">
                  <TileLayer
                    url={FEMA_NFHL}
                    opacity={0.6}
                    attribution='FEMA National Flood Hazard Layer'
                    tileSize={256}
                    crossOrigin
                  />
                </Overlay>

                {false && (
                  <Overlay name="NRT Flood Extent (MODIS/VIIRS)">
                    <TileLayer
                      url={gibsUrl(LAYERS.FLOOD_NRT, date, 'png')}
                      subdomains={SUBDOMAINS}
                      opacity={0.8}
                      attribution='NRT Flood: NASA LANCE (MODIS/VIIRS) via GIBS'
                      tileSize={256}
                      crossOrigin
                    />
                  </Overlay>
                )}
              </>
            )}
          </LayersControl>
        </MapContainer>

        {/* Ripple overlay */}
        <div className="ripple-layer">
          {ripples.map(r => (
            <span key={r.id} className="ripple" style={{ left: r.x, top: r.y }} />
          ))}
        </div>

          {/* Weather card */}
        <WeatherInfoCard box={weatherBox} onClose={() => setWeatherBox(null)} />
      </div>


      <div style={{padding: 8, fontSize: 12, color: '#444', background: '#fafafa', borderTop: '1px solid #ddd'}}>
        <b>Reading tips:</b> Fire overlays = active hotspots (MODIS). IMERG = where it’s raining hard (flood risk proxy). FEMA = areas prone to flood (U.S.). Pick the date to explore recent days.
      </div>
    </div>
  );
}
