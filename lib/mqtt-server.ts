import mqtt, { MqttClient } from "mqtt";

export function publishMqtt(
  topicSuffix: "control" | "config",
  payload: object,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const brokerUrl = process.env.MQTT_BROKER_URL;
    const prefix = process.env.MQTT_TOPIC_PREFIX;
    if (!brokerUrl || !prefix) {
      reject(new Error("Konfigurasi MQTT server belum lengkap"));
      return;
    }

    let settled = false;
    const client: MqttClient = mqtt.connect(brokerUrl, {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      protocolVersion: 4,
      reconnectPeriod: 0,
      connectTimeout: 10_000,
      rejectUnauthorized: true,
    });

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      client.end(true, {}, () => (error ? reject(error) : resolve()));
    };

    client.once("connect", () => {
      client.publish(
        `${prefix}/${topicSuffix}`,
        JSON.stringify(payload),
        { qos: 1 },
        (error) => {
          finish(error ? new Error(error.message) : undefined);
        },
      );
    });
    client.once("error", (error) => finish(error));
  });
}
