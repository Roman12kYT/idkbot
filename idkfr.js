const fs = require('fs');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

// Зчитуємо токен
let token;
try {
    token = fs.readFileSync('token.txt', 'utf8').trim();
} catch (err) {
    console.error('❌ Помилка: файл token.txt не знайдено або не читається!');
    process.exit(1);
}

// Конфіг і база інцидентів
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
let incidents = {};
try {
    incidents = JSON.parse(fs.readFileSync('./incidents.json', 'utf8'));
} catch {
    incidents = {};
}

// Ініціалізація Discord-клієнта
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

// Автонаказ і перевірка нецензурщини
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;

    // Перевірка на нецензурні слова
    const lowered = message.content.toLowerCase();
    let triggered = false;

    for (const swear of config.swearWords) {
        if (lowered.includes(swear)) {
            triggered = true;
            break;
        }
    }

    if (triggered) {
        if (!incidents[userId]) incidents[userId] = { points: 0, logs: [] };

        incidents[userId].points += 1;
        incidents[userId].logs.push({
            type: 'auto',
            reason: 'Нецензурна лексика',
            date: new Date().toISOString()
        });

        saveIncidents();

        console.log(`[⚠️] ${message.author.tag} порушив правила. Очки: ${incidents[userId].points}`);

        if (incidents[userId].points >= config.warnThreshold) {
            try {
                await message.member.timeout(60_000, 'Перевищено ліміт інцидентів');
                message.channel.send(`<@${userId}> отримав тайм-аут за порушення.`);
            } catch (e) {
                console.error(`❌ Не вдалося видати тайм-аут: ${e}`);
            }
        }
    }
});

// Команда вручну: !warn @user [категорія]
client.on('messageCreate', async (message) => {
    if (!message.content.startsWith('!warn')) return;
    if (!config.moderators.includes(message.author.id)) return;

    const args = message.content.split(' ');
    const member = message.mentions.members.first();
    const category = args.slice(2).join(' ') || 'Без категорії';

    if (!member) {
        return message.reply('❌ Вкажіть користувача!');
    }

    const userId = member.id;
    if (!incidents[userId]) incidents[userId] = { points: 0, logs: [] };

    incidents[userId].points += 1;
    incidents[userId].logs.push({
        type: 'manual',
        reason: category,
        date: new Date().toISOString()
    });

    saveIncidents();

    await message.channel.send(`⚠️ <@${userId}> отримав попередження. Категорія: **${category}**. Очки: ${incidents[userId].points}`);
});

// Збереження інцидентів у файл
function saveIncidents() {
    fs.writeFileSync('./incidents.json', JSON.stringify(incidents, null, 2));
}

// Запуск
client.once('ready', () => {
    console.log(`✅ Бот активний як ${client.user.tag}`);
});

client.login(token);
