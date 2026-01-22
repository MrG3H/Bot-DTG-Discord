// ARQUIVO: migrar.js
require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Função Geradora de Tags
function gerarTags(titulo) {
    const t = titulo.toLowerCase();
    const limpo = t.replace(/[^a-z0-9 ]/g, ''); // Remove : - .
    const palavras = limpo.split(' ');
    const sigla = palavras.map(p => p[0]).join(''); 
    
    // Gera tags combinadas
    return `${t} ${limpo} ${sigla}`;
}

(async () => {
    try {
        await db.connect();
        console.log("🔌 Conectado ao PostgreSQL!");

        // 1. Cria a Tabela se não existir
        await db.query(`
            CREATE TABLE IF NOT EXISTS jogos (
                id SERIAL PRIMARY KEY,
                titulo TEXT NOT NULL,
                link TEXT NOT NULL,
                tipo TEXT NOT NULL,
                obs TEXT,
                tags_busca TEXT,
                data_add TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Tabela 'jogos' verificada/criada.");

        // 2. Lê o JSON antigo
        if (!fs.existsSync('./ultimosLancamentos.json')) {
            console.log("❌ Arquivo JSON não encontrado. Nada para migrar.");
            process.exit(0);
        }
        
        const dadosAntigos = JSON.parse(fs.readFileSync('./ultimosLancamentos.json', 'utf8'));
        console.log(`📦 Encontrados ${dadosAntigos.length} jogos no JSON. Migrando...`);

        // 3. Insere no Banco
        for (const jogo of dadosAntigos) {
            const tags = gerarTags(jogo.title);
            // Verifica se já existe para não duplicar se rodar 2 vezes
            const check = await db.query('SELECT id FROM jogos WHERE titulo = $1', [jogo.title]);
            
            if (check.rowCount === 0) {
                await db.query(
                    'INSERT INTO jogos (titulo, link, tipo, obs, tags_busca) VALUES ($1, $2, $3, $4, $5)',
                    [jogo.title, jogo.link, jogo.type, jogo.obs || '', tags]
                );
                console.log(`games ➤ Migrado: ${jogo.title} (Tags: ${tags})`);
            }
        }

        console.log("🏁 Migração concluída com sucesso!");
    } catch (err) {
        console.error("Erro:", err);
    } finally {
        await db.end();
    }
})();