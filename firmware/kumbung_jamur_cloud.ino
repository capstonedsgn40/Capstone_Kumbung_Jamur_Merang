/*
  ESP32 Mushroom Mist Nozzle Controller
  Arduino Cloud Thing variables:
  - suhu (CloudFloat, read only)
  - kelembapan (CloudFloat, read only)
  - pompaStatus (CloudBool, read/write)
  - modeAuto (CloudBool, read/write)
  - batasBawahRH (CloudFloat, read/write)
*/

#include <ArduinoIoTCloud.h>
#include <Arduino_ConnectionHandler.h>
#include <DHT.h>
#include <esp_task_wdt.h>

// ===== Hardware abstraction =====
constexpr uint8_t DHTPIN = 15;
#define DHTTYPE DHT22
constexpr uint8_t PUMP_PIN = 2;
constexpr bool RELAY_ACTIVE_LOW = true;

#define BOARD_ESP32

const char SSID[] = "ISI_SSID";
const char PASS[] = "ISI_PASSWORD";
const char DEVICE_LOGIN_NAME[] = "ISI_DEVICE_ID";
const char DEVICE_KEY[] = "ISI_DEVICE_SECRET";

DHT dht(DHTPIN, DHTTYPE);
WiFiConnectionHandler ArduinoIoTPreferredConnection(SSID, PASS);

CloudFloat suhu;
CloudFloat kelembapan;
CloudBool pompaStatus;
CloudBool modeAuto;
CloudFloat batasBawahRH;

uint8_t errorCount = 0;
bool criticalFailSafe = false;
unsigned long lastSensorRead = 0;
unsigned long lastPumpChange = 0;

constexpr unsigned long SENSOR_INTERVAL_MS = 2500;
constexpr unsigned long MIN_PUMP_STATE_MS = 5000;
constexpr unsigned long WDT_TIMEOUT_SECONDS = 20;
constexpr float HYSTERESIS_OFFSET = 8.0;

void setPump(bool on) {
  unsigned long now = millis();
  if (on == pompaStatus) return;
  if (now - lastPumpChange < MIN_PUMP_STATE_MS) return;

  digitalWrite(PUMP_PIN, RELAY_ACTIVE_LOW ? (on ? LOW : HIGH) : (on ? HIGH : LOW));
  pompaStatus = on;
  lastPumpChange = now;
  ArduinoCloud.update();
}

void forcePumpOff() {
  digitalWrite(PUMP_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
  pompaStatus = false;
  lastPumpChange = millis();
  ArduinoCloud.update();
}

void initProperties() {
  ArduinoCloud.addProperty(suhu, READ, ON_CHANGE, NULL);
  ArduinoCloud.addProperty(kelembapan, READ, ON_CHANGE, NULL);
  ArduinoCloud.addProperty(pompaStatus, READWRITE, ON_CHANGE, onPompaStatusChange);
  ArduinoCloud.addProperty(modeAuto, READWRITE, ON_CHANGE, onModeAutoChange);
  ArduinoCloud.addProperty(batasBawahRH, READWRITE, ON_CHANGE, NULL);
}

void onPompaStatusChange() {
  if (criticalFailSafe) {
    forcePumpOff();
    return;
  }

  modeAuto = false;
  setPump(pompaStatus);
}

void onModeAutoChange() {
  if (modeAuto && criticalFailSafe) {
    forcePumpOff();
  }
}

void setup() {
  Serial.begin(115200);

  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
  pompaStatus = false;
  modeAuto = true;
  batasBawahRH = 80.0;
  lastPumpChange = millis();

  dht.begin();

  esp_task_wdt_init(WDT_TIMEOUT_SECONDS, true);
  esp_task_wdt_add(NULL);

  initProperties();
  ArduinoCloud.begin(ArduinoIoTPreferredConnection);
}

void applySensorLogic() {
  if (criticalFailSafe) {
    forcePumpOff();
    return;
  }

  if (!modeAuto) return;

  float lower = batasBawahRH;
  if (lower < 60.0) lower = 60.0;
  if (lower > 90.0) lower = 90.0;
  float upper = lower + HYSTERESIS_OFFSET;
  if (upper > 95.0) upper = 95.0;

  if (kelembapan < lower) setPump(true);
  else if (kelembapan >= upper) setPump(false);
}

void loop() {
  ArduinoCloud.update();
  esp_task_wdt_reset();

  unsigned long now = millis();
  if (now - lastSensorRead >= SENSOR_INTERVAL_MS) {
    lastSensorRead = now;

    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (isnan(h) || isnan(t) || h < 0.0 || h > 100.0 || t < -10.0 || t > 60.0) {
      errorCount++;
      if (errorCount >= 3) {
        criticalFailSafe = true;
        forcePumpOff();
        Serial.println("CRITICAL FAIL-SAFE: sensor gagal 3 kali berturut-turut; pompa dimatikan");
      }
    } else {
      errorCount = 0;
      criticalFailSafe = false;
      suhu = t;
      kelembapan = h;
      applySensorLogic();
    }
  }
}
