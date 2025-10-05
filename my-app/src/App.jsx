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

function ClickRippleLayer({ onClickAtPx, speakEnabled }) {
  useMapEvents({
    click: async (e) => {
      // Always show ripple
      onClickAtPx(e.containerPoint.x, e.containerPoint.y);
      // Optionally speak
      if (speakEnabled) {
        const { lat, lng } = e.latlng;
        await speakTestEmergencyAt(lat, lng);
      }
    }
  });
  return null;
}


export default function App() {
  const [date, setDate] = useState(dayjs().subtract(1, 'day').format('YYYY-MM-DD'));
  const [testMode, setTestMode] = useState(false);
  const [filters, setFilters] = useState({ burning: true, flooding: true });
  const center = useMemo(() => [30.2672, -97.7431], []);
  const [ripples, setRipples] = useState([]);

  const addRipple = (x, y) => {
    const id = Math.random().toString(36).slice(2);
    setRipples(rs => [...rs, { id, x, y }]);
    // remove after animation completes
    setTimeout(() => setRipples(rs => rs.filter(r => r.id !== id)), 750);
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
        >
          <ClickRippleLayer onClickAtPx={addRipple} speakEnabled={testMode} />

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
      </div>


      <div style={{padding: 8, fontSize: 12, color: '#444', background: '#fafafa', borderTop: '1px solid #ddd'}}>
        <b>Reading tips:</b> Fire overlays = active hotspots (MODIS). IMERG = where it’s raining hard (flood risk proxy). FEMA = areas prone to flood (U.S.). Pick the date to explore recent days.
      </div>
    </div>
  );
}
