import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const readline  = createInterface({ input, output });
const favoritesPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'cities.json',
);
const historyPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'history.json',
);

const weatherDescriptions  = {
  0: 'Cielo sereno',
  1: 'Prevalentemente sereno',
  2: 'Parzialmente nuvoloso',
  3: 'Coperto',
  45: 'Nebbia',
  48: 'Nebbia con brina',
  51: 'Pioviggine leggera',
  53: 'Pioviggine moderata',
  55: 'Pioviggine intensa',
  56: 'Pioviggine gelata leggera',
  57: 'Pioviggine gelata intensa',
  61: 'Pioggia debole',
  63: 'Pioggia moderata',
  65: 'Pioggia forte',
  66: 'Pioggia gelata leggera',
  67: 'Pioggia gelata forte',
  71: 'Neve debole',
  73: 'Neve moderata',
  75: 'Neve forte',
  77: 'Granelli di neve',
  80: 'Rovesci di pioggia deboli',
  81: 'Rovesci di pioggia moderati',
  82: 'Rovesci di pioggia violenti',
  85: 'Rovesci di neve deboli',
  86: 'Rovesci di neve forti',
  95: 'Temporale',
  96: 'Temporale con grandine debole',
  97: 'Temporale forte',
  99: 'Temporale con grandine forte',
};

function showMenu( selectedCity ) {
  console.log('\n================================');
  console.log('       WEATHER DASHBOARD');
  console.log('================================');
  if( selectedCity ) {
   console.log(`Città selezionata: ${selectedCity.name}, ${selectedCity.country}`);
    console.log('--------------------------------');
  }
   console.log('1. Cerca una città');
  console.log('2. Visualizza meteo atuale');
  console.log('3. Visualizza previsoni settimanali');
  console.log('4. Visualizza città preferite');
  console.log('5. Aggiungi città ai preferitti');
  console.log('6. Visualizza cronologia riccerche');
  console.log('7. Esci');
}

async function searchCity( cityName ) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', cityName);
  url.searchParams.set('count', '5');
  url.searchParams.set('language', 'it');
  url.searchParams.set('format', 'json');

  const response  = await fetch(url);
  if (!response.ok) {
    throw new Error(`La ricerca delle città non è riuscita (HTTP ${response.status}).`);
  }

  const data = await response.json();
  const cities = data.results ?? [];

  if( cities.length === 0 ) {
    console.log('Nessuna città trovata. Prova con un altro nome.');
    return null;
  }

  console.log('\nCitta trovate:');
  cities.forEach((city,index) => {
    const location = [city.name, city.admin1, city.country]
       .filter(Boolean)
      .join(', ');
    console.log(`${index + 1}. ${location}`);
  });

  while (true) {
    const answer = (await readline.question('\nScegli una città (0 per annullare): ')).trim();
     if (answer === '0') return null;

    const index  = Number(answer);
    if (Number.isInteger(index) && index >= 1 && index <= cities.length) {
      return cities[index - 1];
    }

    console.log(`Inserisci un numero da 1 a ${cities.length}, oppure 0 per annullare.`);
  }
}

async function getCurrentWeather( latitude, longitude ) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', latitude);
  url.searchParams.set('longitude', longitude);
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day',
  );
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`La richiesta meteo non è riuscita (HTTP ${response.status}).`);
  }

  const data  = await response.json();
  if (!data.current) {
    throw new Error('La risposta non contiene i dati meteo attuali.');
  }

  return { current: data.current, units: data.current_units };
}

function showCurrentWeather( city, { current, units } ) {
  console.log('\n================================');
  console.log('         METEO ATUALE');
  console.log('================================');
  console.log(`Città: ${city.name}, ${city.country}`);
  console.log(`Temperatura: ${current.temperature_2m} ${units.temperature_2m}`);
   console.log(`Temperatura percepita: ${current.apparent_temperature} ${units.apparent_temperature}`);
  console.log(`Umidità: ${current.relative_humidity_2m}${units.relative_humidity_2m}`);
  console.log(`Vento: ${current.wind_speed_10m} ${units.wind_speed_10m}`);
  console.log(`Condizioni: ${weatherDescriptions[current.weather_code] ?? 'Non disponibili'}`);
  console.log(`Momento: ${current.is_day === 1 ? 'Giorno' : 'Notte'}`);
  console.log('================================');
}

async function getWeatherForecast( latitude, longitude ) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', latitude);
  url.searchParams.set('longitude', longitude);
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  );
  url.searchParams.set('forecast_days', '7');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`La richiesta delle previsioni non è riuscita (HTTP ${response.status}).`);
  }

  const data = await response.json();
  const daily  = data.daily;
  const fields = [
    daily?.time,
    daily?.weather_code,
    daily?.temperature_2m_max,
    daily?.temperature_2m_min,
    daily?.precipitation_probability_max,
  ];
  if (!fields.every((field) => Array.isArray(field) && field.length >= 7)) {
    throw new Error('La risposta non contiene sette giorni di previsioni complete.');
  }

  return { daily, units: data.daily_units };
}

function showWeatherForecast(city, { daily, units }) {
  console.log('\n================================');
  console.log('    PREVISONI PER 7 GIORNI');
  console.log('================================');
  console.log(`Città: ${city.name}, ${city.country}`);

  for(let index = 0; index < 7; index++) {
    const [year, month, day] = daily.time[index].split('-');
    const rainProbability = daily.precipitation_probability_max[index];

    console.log(`\n${day}/${month}/${year}`);
    console.log(`Minima: ${daily.temperature_2m_min[index]} ${units.temperature_2m_min}`);
     console.log(`Massima: ${daily.temperature_2m_max[index]} ${units.temperature_2m_max}`);
    console.log(`Probabilità pioggia: ${rainProbability ?? 'n/d'}${rainProbability == null ? '' : units.precipitation_probability_max}`);
    console.log(`Condizioni: ${weatherDescriptions[daily.weather_code[index]] ?? 'Non disponibili'}`);
  }

  console.log('================================');
}

async function loadFavoriteCities() {
  const fileContents = await readFile(favoritesPath, 'utf8');
  const cities = JSON.parse(fileContents);

  if (!Array.isArray(cities)) {
    throw new Error('Il file cities.json deve contenere una lista di città.');
  }

  return cities;
}

async function addFavoriteCity( city ) {
  const favorites = await loadFavoriteCities();
  const alreadySaved = favorites.some((favorite) =>
    favorite.name === city.name &&
    favorite.country === city.country &&
    favorite.latitude === city.latitude &&
    favorite.longitude === city.longitude
  );

  if( alreadySaved ) return false;

  favorites.push({
    name: city.name,
    admin1: city.admin1,
   country: city.country,
    latitude: city.latitude,
    longitude: city.longitude,
  });
   await writeFile(favoritesPath, `${JSON.stringify(favorites, null, 2)}\n`);
  return true;
}

async function loadSearchHistory() {
  const fileContents = await readFile(historyPath, 'utf8');
  const history = JSON.parse(fileContents);

  if (!Array.isArray(history)) {
    throw new Error('Il file history.json deve contenere una lista di ricerche.');
  }

  return history;
}

async function recordSearch(city) {
  const history = await loadSearchHistory();
   history.push({
    name: city.name,
    admin1: city.admin1,
    country: city.country,
    searchedAt: new Date().toISOString(),
  });
  await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`);
}

async function main() {
  let  running = true;
  let selectedCity = null;

  while (running) {
    showMenu(selectedCity);
    const choice = (await readline.question('\nSeleziona un\'opzione: ')).trim();

    switch( choice ) {
      case '1':
        {
          const cityName = (await readline.question('Nome della città: ')).trim();
          if( !cityName ) {
            console.log('Inserisci il nome di una città.');
            break;
          }

          try {
            const city = await searchCity(cityName);
            if (city) {
              selectedCity = city;
              console.log(`Hai selezionato: ${city.name}, ${city.country}.`);
              console.log('Ora scegli 2 per il meteo, 3 per le previsioni o 5 per salvarla nei preferiti.');
              try {
                await recordSearch(city);
              } catch (error) {
                console.log(`Città selezionata, ma cronologia non salvata: ${error.message}`);
              }
            }
          } catch (error) {
            console.log(`Errore: ${error.message}`);
          }
        }
        break;
      case '2':
        if (!selectedCity) {
           console.log('Prima seleziona una città con l’opzione 1 o 4.');
          break;
        }

        try {
          console.log(`Caricamento meteo attuale per ${selectedCity.name}...`);
          const weather = await getCurrentWeather(
            selectedCity.latitude,
            selectedCity.longitude,
          );
          showCurrentWeather(selectedCity, weather);
        } catch (error) {
          const message = error.name === 'TimeoutError'
            ? 'La richiesta meteo impiega troppo tempo. Riprova.'
            : error.message;
          console.log(`Errore: ${message}`);
        }
        break;
      case '3':
        if (!selectedCity) {
          console.log('Prima seleziona una città con l’opzione 1 o 4.');
          break;
        }

        try {
          console.log(`Caricamento previsioni per ${selectedCity.name}...`);
          const forecast = await getWeatherForecast(
            selectedCity.latitude,
            selectedCity.longitude,
          );
          showWeatherForecast(selectedCity, forecast);
        } catch (error) {
          const message = error.name === 'TimeoutError'
            ? 'La richiesta delle previsioni impiega troppo tempo. Riprova.'
            : error.message;
          console.log(`Errore: ${message}`);
        }
        break;
      case '4':
        try {
          const favorites = await loadFavoriteCities();
          if( favorites.length === 0 ) {
            console.log('Non hai ancora città preferitte.');
          } else {
            console.log('\nCittà preferite:');
            favorites.forEach((city, index) => {
              const location = [city.name, city.admin1, city.country]
                .filter(Boolean)
                .join(', ');
              console.log(`${index + 1}. ${location}`);
            });

            while (true) {
              const answer = (await readline.question('\nScegli una città (0 per tornare al menu): ')).trim();
              if (answer === '0') break;

              const index  = Number(answer);
              if (Number.isInteger(index) && index >= 1 && index <= favorites.length) {
                selectedCity = favorites[index - 1];
                console.log(`Hai selezionato: ${selectedCity.name}, ${selectedCity.country}.`);
                console.log('Ora scegli 2 per il meteo o 3 per le previsioni.');
                break;
              }

              console.log(`Inserisci un numero da 1 a ${favorites.length}, oppure 0 per tornare al menu.`);
            }
          }
        } catch (error) {
          console.log(`Errore nella lettura dei preferiti: ${error.message}`);
        }
        break;
      case '5':
        if (!selectedCity) {
          console.log('Prima seleziona una città con l’opzione 1 o 4.');
          break;
        }

        try {
          const added = await addFavoriteCity(selectedCity);
          console.log(added
            ? `${selectedCity.name}, ${selectedCity.country} aggiunta ai preferiti.`
            : 'Questa città è già nei preferiti.');
        } catch (error) {
          console.log(`Errore nel salvataggio dei preferiti: ${error.message}`);
        }
        break;
      case '6':
        try {
          const history = await loadSearchHistory();
          if (history.length === 0) {
            console.log('Non hai ancora ricerche nella cronologia.');
          } else {
            console.log('\nCronologia ricerche:');
            history.slice().reverse().forEach((entry, index) => {
             const location = [entry.name, entry.admin1, entry.country]
                .filter(Boolean)
                .join(', ');
              const searchedAt = new Intl.DateTimeFormat('it-IT', {
                dateStyle: 'short',
                timeStyle: 'short',
                timeZone: 'Europe/Rome',
              }).format(new Date(entry.searchedAt));
              console.log(`${index + 1}. ${location} — ${searchedAt}`);
            });
          }
        } catch (error) {
          console.log(`Errore nella lettura della cronologia: ${error.message}`);
        }
        break;
      case '7':
        console.log('Arrivederci!');
        running = false;
        break;
      default:
        console.log('Opzione non valida. Inserisci un numero da 1 a 7.');
    }
  }
}

try {
  await main();
} finally {
  readline.close();
}
