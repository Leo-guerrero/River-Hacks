import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { MapContainer, TileLayer, LayersControl } from 'react-leaflet';
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

export default function App() {
  const [date, setDate] = useState(dayjs().subtract(1, 'day').format('YYYY-MM-DD'));
  const [filters, setFilters] = useState({ burning: true, flooding: true });
  const center = useMemo(() => [30.2672, -97.7431], []);

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
      <div style={{flex: 1}}>
        <MapContainer center={center} zoom={5} style={{height: '100%', width: '100%'}}>
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
                  />
                </Overlay>
              </>
            )}

            {/* FLOODING group */}
            {filters.flooding && (
              <>
                {/* IMERG precipitation rate (proxy for current flood risk) */}
                <Overlay checked name="Precipitation Rate (IMERG)">
                  <TileLayer
                    url={gibsUrl(LAYERS.IMERG_RATE, date, 'png')}
                    subdomains={SUBDOMAINS}
                    opacity={0.6}
                    attribution='GPM IMERG Precipitation Rate: NASA EOSDIS GIBS'
                    tileSize={256}
                    crossOrigin
                  />
                </Overlay>

                {/* FEMA NFHL (US only; regulatory/long-term hazard) */}
                <Overlay name="FEMA Flood Hazard Zones (US)">
                  <TileLayer
                    url={FEMA_NFHL}
                    opacity={0.6}
                    attribution='FEMA National Flood Hazard Layer'
                    tileSize={256}
                    crossOrigin
                  />
                </Overlay>

                {/* Optional: when NRT flood extent layer id is available in your GIBS endpoint */}
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
      </div>

      <div style={{padding: 8, fontSize: 12, color: '#444', background: '#fafafa', borderTop: '1px solid #ddd'}}>
        <b>Reading tips:</b> Fire overlays = active hotspots (MODIS). IMERG = where it’s raining hard (flood risk proxy). FEMA = areas prone to flood (U.S.). Pick the date to explore recent days.
      </div>
    </div>
  );
}
