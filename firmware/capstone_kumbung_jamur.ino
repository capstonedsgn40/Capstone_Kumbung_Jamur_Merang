#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// 1. KONFIGURASI WIFI & MQTT BROKER
const char* WIFI_SSID = "ISI_SSID_WIFI_ANDA";
const char* WIFI_PASS = "ISI_PASSWORD_WIFI_ANDA";

const bool USE_TLS = true; 
const char* MQTT_SERVER = "mqtts://your_broker_address.emqxsl.com:8883";
const int   MQTT_PORT   = 8883;
const char* MQTT_USER   = "ISI_USERNAME_MQTT_ANDA";   
const char* MQTT_PASS   = "ISI_PASSWORD_MQTT_ANDA";

// Topik MQTT (Gunakan prefix unik agar tidak bentrok di broker publik)
const char* TOPIC_TELEMETRY = "kumbung_jamur_capstone_9921/telemetry";
const char* TOPIC_CONTROL   = "kumbung_jamur_capstone_9921/control";
const char* TOPIC_CONFIG    = "kumbung_jamur_capstone_9921/config";

// 2. KONFIGURASI HARDWARE (6 DHT22, LCD, RELAY)
#define DHTTYPE DHT22
const int JUMLAH_SENSOR = 6;
const int DHT_PINS[JUMLAH_SENSOR] = {4, 16, 17, 18, 19, 23};

DHT dhtSensors[JUMLAH_SENSOR] = {
  DHT(DHT_PINS[0], DHTTYPE),
  DHT(DHT_PINS[1], DHTTYPE),
  DHT(DHT_PINS[2], DHTTYPE),
  DHT(DHT_PINS[3], DHTTYPE),
  DHT(DHT_PINS[4], DHTTYPE),
  DHT(DHT_PINS[5], DHTTYPE)
};

#define PUMP_PIN 26
LiquidCrystal_I2C lcd(0x27, 16, 2);

// 3. STATE SISTEM & PENGATURAN PER FASE
bool pompaStatus = false;
bool modeAuto    = true;
String faseAktif = "VEGETATIF"; // Pilihan: "VEGETATIF" atau "GENERATIF"

// Batas RH terpisah untuk masing-masing fase
float vegBawahRH = 80.0;
float vegAtasRH  = 88.0;

float genBawahRH = 85.0;
float genAtasRH  = 93.0;

unsigned long lastReadTime      = 0;
unsigned long lastReconnectTime = 0;
const unsigned long READ_INTERVAL = 3000;

WiFiClient espClient;
WiFiClientSecure espClientSecure;
PubSubClient mqttClient;

// Helper mengambil batas aktif sesuai fase berjalan
float getActiveBawahRH() {
  return (faseAktif == "GENERATIF") ? genBawahRH : vegBawahRH;
}

float getActiveAtasRH() {
  return (faseAktif == "GENERATIF") ? genAtasRH : vegAtasRH;
}

// 4. CALLBACK MQTT (MENERIMA PERINTAH DARI WEB)
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.print("[MQTT IN] "); Serial.print(topic); Serial.print(" => "); Serial.println(message);

  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.println("[ERROR] Gagal parsing JSON perintah!");
    return;
  }

  // A. Perintah Kontrol Real-Time (Mode Auto/Manual & Tombol Pompa)
  if (String(topic) == TOPIC_CONTROL) {
    if (doc["modeAuto"].is<bool>()) {
      modeAuto = doc["modeAuto"];
    }
    if (!modeAuto && doc["pompa"].is<bool>()) {
      setPompa(doc["pompa"]);
    }
  }

  // B. Pengaturan Fase & Threshold RH Terpisah
  if (String(topic) == TOPIC_CONFIG) {
    // 1. Ubah fase aktif ("VEGETATIF" atau "GENERATIF")
    if (doc["fase"].is<const char*>()) {
      String faseBaru = doc["fase"].as<String>();
      faseBaru.toUpperCase();
      if (faseBaru == "VEGETATIF" || faseBaru == "GENERATIF") {
        faseAktif = faseBaru;
        Serial.println("[CONFIG] Fase diubah ke: " + faseAktif);
      }
    }

    // 2. Update batas RH khusus Fase Vegetatif
    if (doc["vegetatif"].is<JsonObject>()) {
      JsonObject veg = doc["vegetatif"];
      if (veg["bawah"].is<float>() && veg["atas"].is<float>()) {
        float b = veg["bawah"];
        float a = veg["atas"];
        if (b < a) { // Validasi agar batas bawah selalu lebih kecil dari atas
          vegBawahRH = b;
          vegAtasRH  = a;
        }
      }
    }

    // 3. Update batas RH khusus Fase Generatif
    if (doc["generatif"].is<JsonObject>()) {
      JsonObject gen = doc["generatif"];
      if (gen["bawah"].is<float>() && gen["atas"].is<float>()) {
        float b = gen["bawah"];
        float a = gen["atas"];
        if (b < a) {
          genBawahRH = b;
          genAtasRH  = a;
        }
      }
    }
  }

  // Langsung kirim telemetry terbaru agar UI website langsung sinkron tanpa tunggu 3 detik
  prosesSensorDanKirim();
}

// 5. KONEKSI WIFI & MQTT NON-BLOCKING
void setupWiFi() {
  Serial.print("Menghubungkan ke WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nWiFi Terhubung! IP: " + WiFi.localIP().toString());
}

void reconnectMQTT() {
  if (mqttClient.connected()) return;

  unsigned long now = millis();
  if (now - lastReconnectTime < 5000) return;
  lastReconnectTime = now;

  Serial.print("Menghubungkan ke MQTT Broker...");
  String clientId = "ESP32-Kumbung-" + String(random(0xffff), HEX);

  bool connected = false;
  if (strlen(MQTT_USER) > 0) {
    connected = mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS);
  } else {
    connected = mqttClient.connect(clientId.c_str());
  }

  if (connected) {
    Serial.println(" BERHASIL!");
    mqttClient.subscribe(TOPIC_CONTROL);
    mqttClient.subscribe(TOPIC_CONFIG);
  } else {
    Serial.print(" GAGAL, rc="); Serial.println(mqttClient.state());
  }
}

// 6. SETUP & MAIN LOOP
void setup() {
  Serial.begin(115200);

  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW);

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("IoT Kumbung Jamur");
  lcd.setCursor(0, 1);
  lcd.print("Menghubungkan...");

  for (int i = 0; i < JUMLAH_SENSOR; i++) {
    dhtSensors[i].begin();
  }

  setupWiFi();

  if (USE_TLS) {
    espClientSecure.setInsecure();
    mqttClient.setClient(espClientSecure);
  } else {
    mqttClient.setClient(espClient);
  }

  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setBufferSize(1536); // Buffer diperbesar untuk payload konfigurasi 2 fase
  mqttClient.setCallback(mqttCallback);
}

void loop() {
  if (!mqttClient.connected()) {
    reconnectMQTT();
  } else {
    mqttClient.loop();
  }

  unsigned long currentMillis = millis();
  if (currentMillis - lastReadTime >= READ_INTERVAL) {
    lastReadTime = currentMillis;
    prosesSensorDanKirim();
  }
}

// 7. BACA 6 SENSOR, LOGIKA HYSTERESIS & PUBLISH JSON
void prosesSensorDanKirim() {
  JsonDocument doc;
  JsonArray sensorsArray = doc["sensors"].to<JsonArray>();

  float totalRH = 0.0;
  float totalSuhu = 0.0;
  int sensorValid = 0;

  for (int i = 0; i < JUMLAH_SENSOR; i++) {
    float h = dhtSensors[i].readHumidity();
    float t = dhtSensors[i].readTemperature();

    JsonObject sObj = sensorsArray.add<JsonObject>();
    sObj["id"] = i + 1;
    sObj["pin"] = DHT_PINS[i];

    if (isnan(h) || isnan(t)) {
      sObj["ok"] = false;
      sObj["t"] = nullptr;
      sObj["h"] = nullptr;
    } else {
      sObj["ok"] = true;
      sObj["t"] = round(t * 10.0) / 10.0;
      sObj["h"] = round(h * 10.0) / 10.0;

      totalRH += h;
      totalSuhu += t;
      sensorValid++;
    }
  }

  if (sensorValid == 0) {
    setPompa(false);
    updateLCD(0, 0, true);
    doc["status"] = "CRITICAL_SENSOR_ERROR";
    doc["pompa"] = false;
    kirimTelemetry(doc);
    return;
  }

  float avgRH   = round((totalRH / sensorValid) * 10.0) / 10.0;
  float avgSuhu = round((totalSuhu / sensorValid) * 10.0) / 10.0;

  // Ambil batas atas & bawah sesuai fase yang sedang aktif
  float targetBawah = getActiveBawahRH();
  float targetAtas  = getActiveAtasRH();

  // Logika Hysteresis Otomatis
  if (modeAuto) {
    if (avgRH < targetBawah && !pompaStatus) {
      setPompa(true);
    } else if (avgRH >= targetAtas && pompaStatus) {
      setPompa(false);
    }
  }

  updateLCD(avgSuhu, avgRH, false);

  // Payload Telemetry lengkap untuk Website Dashboard
  doc["status"]      = "ONLINE";
  doc["avgTemp"]     = avgSuhu;
  doc["avgRH"]       = avgRH;
  doc["activeCount"] = sensorValid;
  doc["pompa"]       = pompaStatus;
  doc["modeAuto"]    = modeAuto;
  doc["fase"]        = faseAktif;

  // Kirim batas aktif saat ini
  doc["activeBawahRH"] = targetBawah;
  doc["activeAtasRH"]  = targetAtas;

  // Kirim konfigurasi tersimpan kedua fase agar input form di web tetap sinkron
  JsonObject configObj = doc["config"].to<JsonObject>();
  configObj["vegetatif"]["bawah"] = vegBawahRH;
  configObj["vegetatif"]["atas"]  = vegAtasRH;
  configObj["generatif"]["bawah"] = genBawahRH;
  configObj["generatif"]["atas"]  = genAtasRH;

  kirimTelemetry(doc);
}

void kirimTelemetry(JsonDocument& doc) {
  String output;
  serializeJson(doc, output);

  Serial.println("[MQTT OUT] " + output);
  if (mqttClient.connected()) {
    mqttClient.publish(TOPIC_TELEMETRY, output.c_str());
  }
}

void setPompa(bool nyala) {
  pompaStatus = nyala;
  digitalWrite(PUMP_PIN, nyala ? HIGH : LOW);
}

void updateLCD(float suhu, float rh, bool isError) {
  lcd.clear();
  if (isError) {
    lcd.setCursor(0, 0); lcd.print("SENSOR ERROR!");
    lcd.setCursor(0, 1); lcd.print("Pompa: OFF");
    return;
  }
  lcd.setCursor(0, 0);
  lcd.print("T:"); lcd.print(suhu, 1); lcd.print("C ");
  lcd.print("H:"); lcd.print(rh, 0); lcd.print("%");

  lcd.setCursor(0, 1);
  lcd.print(pompaStatus ? "P:ON " : "P:OFF");
  lcd.print(modeAuto ? " [A|" : " [M|");
  lcd.print(faseAktif == "GENERATIF" ? "GEN]" : "VEG]");
}