// index.js
import express from "express";
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import fs from "fs";

const app = express();
app.use(express.json());

// --- 1️⃣ Basic Ping for UptimeRobot ---
app.get("/", (req, res) => {
  res.send("Bot is alive!");
});

// --- 2️⃣ Discord Bot Setup ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const DATA_FILE = "./leagueData.json";

// --- 3️⃣ Load & Save Data ---
let leagueData = { players: {}, teams: {}, standings: [], transactions: [] };
if (fs.existsSync(DATA_FILE)) leagueData = JSON.parse(fs.readFileSync(DATA_FILE));

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(leagueData, null, 2));
}

// --- 4️⃣ Discord Commands ---
client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith("!") || msg.author.bot) return;
  const args = msg.content.slice(1).split(" ");
  const cmd = args.shift().toLowerCase();

  // --- Ping ---
  if (cmd === "ping") {
    return msg.reply("🏓 Bot is online!");
  }

  // --- Player Stats ---
  if (cmd === "stats") {
    const player = args.join(" ");
    const stats = leagueData.players[player];
    if (!stats) return msg.reply(`No stats found for ${player}.`);

    const embed = new EmbedBuilder()
      .setTitle(`📊 Stats for ${player}`)
      .setColor("Blue");

    // Batting stats
    if (stats.HR !== undefined) {
      embed.addFields(
        { name: "HR", value: `${stats.HR}`, inline: true },
        { name: "Singles", value: `${stats.Singles}`, inline: true },
        { name: "Doubles", value: `${stats.Doubles}`, inline: true },
        { name: "RBI", value: `${stats.RBI}`, inline: true },
        { name: "AVG", value: `${stats.AVG}`, inline: true }
      );
    }

    // Pitching stats
    if (stats.IP !== undefined) {
      embed.addFields(
        { name: "Innings Pitched", value: `${stats.IP}`, inline: true },
        { name: "Strikeouts", value: `${stats.SO}`, inline: true },
        { name: "Walks", value: `${stats.BB}`, inline: true },
        { name: "ERA", value: `${stats.ERA}`, inline: true }
      );
    }

    return msg.channel.send({ embeds: [embed] });
  }

  // --- Team Stats ---
  if (cmd === "team") {
    const team = args.join(" ");
    const teamStats = leagueData.teams[team];
    if (!teamStats) return msg.reply(`No team found named ${team}.`);

    const embed = new EmbedBuilder()
      .setTitle(`⚾ ${team} Team Stats`)
      .setColor("Green")
      .setDescription(
        `Wins: ${teamStats.Wins}\nLosses: ${teamStats.Losses}\nAVG: ${teamStats.AVG}\nERA: ${teamStats.ERA}`
      );

    return msg.channel.send({ embeds: [embed] });
  }

  // --- League Standings ---
  if (cmd === "standings") {
    const embed = new EmbedBuilder()
      .setTitle("📈 League Standings")
      .setColor("Gold")
      .setDescription(
        leagueData.standings
          .map((s, i) => `${i + 1}. ${s.team} — ${s.wins}-${s.losses}`)
          .join("\n")
      );
    return msg.channel.send({ embeds: [embed] });
  }

  // --- Transactions ---
  if (cmd === "transactions") {
    const recent = leagueData.transactions.slice(-5).reverse();
    const embed = new EmbedBuilder()
      .setTitle("🔁 Recent Transactions")
      .setColor("Orange")
      .setDescription(recent.map((t) => `**${t.type}:** ${t.player} → ${t.team}`).join("\n"));
    return msg.channel.send({ embeds: [embed] });
  }

  // --- Manual Stats Update (Restricted Roles) ---
  if (cmd === "updatestats") {
    const allowedRoles = ["Co-Owner", "Snow"]; // only these roles can update stats
    const memberRoles = msg.member.roles.cache.map(r => r.name);
    const hasPermission = memberRoles.some(r => allowedRoles.includes(r));

    if (!hasPermission) return msg.reply("❌ You do not have permission to update stats.");

    const player = args.shift();
    if (!player) return msg.reply("Please provide a player name.");

    const newStats = {};
    args.forEach(arg => {
      const [key, value] = arg.split("=");
      if (!value) return;
      newStats[key] = value.includes(".") ? parseFloat(value) : parseInt(value) || value;
    });

    leagueData.players[player] = { ...(leagueData.players[player] || {}), ...newStats };
    saveData();

    msg.reply(`✅ Updated stats for ${player}.`);

    // --- Admin logs ---
    const adminLogChannelName = "admin-logs"; // change to your exact channel name
    const adminChannel = msg.guild.channels.cache.find(c => c.name === adminLogChannelName && c.isTextBased());
    if (adminChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle("📝 Stats Updated")
        .setColor("Red")
        .setDescription(`**${msg.author.tag}** updated stats for **${player}**.`)
        .addFields(
          ...Object.keys(newStats).map(k => ({ name: k, value: `${newStats[k]}`, inline: true }))
        )
        .setTimestamp();
      adminChannel.send({ embeds: [logEmbed] });
    }
  }
});

// --- 5️⃣ Endpoint to update stats from Roblox/game backend ---
app.post("/update", (req, res) => {
  const { type, player, team, stats } = req.body;

  if (type === "transaction") {
    leagueData.transactions.push({ player, team, type: stats.action || "Unknown" });
  } else if (type === "stats") {
    leagueData.players[player] = stats;
  } else if (type === "team") {
    leagueData.teams[team] = stats;
  } else if (type === "standings") {
    leagueData.standings = stats;
  }

  saveData();
  res.sendStatus(200);
});

// --- 6️⃣ Start bot and server ---
client.once("ready", () => console.log(`✅ Logged in as ${client.user.tag}`));
client.login(TOKEN);

app.listen(3000, () => console.log("Server running on port 3000"));

