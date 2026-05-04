# ⚔️ Twitch Boss Battle Bot

Bot para eventos interactivos en Twitch donde los viewers pueden atacar a un boss en tiempo real usando comandos en el chat.

---

## 🚀 Características

* 👹 Sistema de boss dinámico por canal
* 👥 Vida basada en viewers en vivo
* ⚖️ Balance automático según actividad
* 💥 Comando `!attack` para participar
* 🏆 Top 3 de daño al finalizar
* 🔐 Seguridad mediante tokens por canal
* 🌐 API REST para controlar eventos

---

## ⚙️ Configuración clave

```js
const ACTIVE_PERCENT = 0.3;
const AVG_DAMAGE = 15;
const MAX_ATTACKS = 1;
```

---

## 🎮 Comandos en chat

* `!attack` → atacar al boss

---

## 📌 Notas

* Si el canal está offline → HP base fijo
* El daño es aleatorio para mayor dinamismo
* El sistema es multi-canal

---

## 🏁 Estado del proyecto

🟢 Activo — en mejora continua

---
