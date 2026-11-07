<div align="center">

# Altınkaya MCP

**Yapay zekâ asistanınıza [Altınkaya](https://www.altinkaya.com) elektronik kutu kataloğunun tamamını bağlayın.**

~500 kutu ailesinde arama yapın, ölçü, IP sınıfı ve malzemeye göre filtreleyin, modelleri
karşılaştırın; teknik çizim ve STEP dosyalarını Claude, Cursor, VS Code veya herhangi bir MCP
istemcisinden alın.

[![npm](https://img.shields.io/npm/v/altinkaya-mcp?color=cb3837&label=npm)](https://www.npmjs.com/package/altinkaya-mcp)
[![CI](https://github.com/amazeng-co/altinkaya-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/amazeng-co/altinkaya-mcp/actions/workflows/ci.yml)
[![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-blue.svg)](LICENSE)

[English](README.en.md)

</div>

## Tek tıkla kurulum

[<img src="https://img.shields.io/badge/VS_Code-Kur-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white" alt="VS Code'a kur">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522altinkaya%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522altinkaya-mcp%2522%255D%257D)
[<img src="https://img.shields.io/badge/VS_Code_Insiders-Kur-24bfa5?style=flat-square&logo=visualstudiocode&logoColor=white" alt="VS Code Insiders'a kur">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522altinkaya%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522altinkaya-mcp%2522%255D%257D)
[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Cursor'a kur" height="20">](https://cursor.com/en/install-mcp?name=altinkaya&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImFsdGlua2F5YS1tY3AiXX0%3D)
[<img src="https://files.lmstudio.ai/deeplink/mcp-install-light.svg" alt="LM Studio'ya ekle" height="20">](https://lmstudio.ai/install-mcp?name=altinkaya&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImFsdGlua2F5YS1tY3AiXX0%3D)
[<img src="https://block.github.io/goose/img/extension-install-dark.svg" alt="Goose'a kur" height="20">](https://block.github.io/goose/extension?cmd=npx&arg=-y&arg=altinkaya-mcp&id=altinkaya&name=Alt%C4%B1nkaya&description=Alt%C4%B1nkaya%20enclosure%20catalog%3A%20search%2C%20filter%2C%20compare%20and%20CAD%20files)

**Claude Desktop:** [son sürümden](https://github.com/amazeng-co/altinkaya-mcp/releases/latest)
`altinkaya-mcp.mcpb` dosyasını indirip çift tıklayın.

Tek gereksinim [Node.js](https://nodejs.org) 22.12 veya üstü. Üyelik veya API anahtarı gerekmez.

## Örnek sorular

> _Dış ortamda çalışacak bir sensör için 80 × 50 × 20 mm PCB'm var. Hangi Altınkaya kutuları
> uyar, en küçük IP67 olan hangisi?_

> _EC-1015 ile EC-1515'i karşılaştır, uygun olanın STEP dosyasını ver._

> _En fazla 4 modül genişliğinde DIN ray kutularını göster._

## Araçlar

| Araç                 | Ne işe yarar?                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `search_enclosures`  | Kod (`EC-1015`), Türkçe/İngilizce ad, kategori ve malzemeye göre arama                     |
| `filter_enclosures`  | Parametrik arama: en az/en fazla dış ölçü (yönden bağımsız), minimum IP, malzeme, kategori |
| `get_enclosure`      | Tek kutunun tüm bilgileri: özellikler, çizim ölçüleri, sipariş kodu ve barkodlu varyantlar |
| `compare_enclosures` | 2–10 kutuyu yan yana karşılaştırma, farklı alanları işaretleme                             |
| `list_categories`    | Kutu sayılarıyla kategori ağacı                                                            |
| `get_cad_files`      | PDF çizim, DXF, STEP, IP sertifikası, CNC işleme ve UV baskı şablonu linkleri              |

Ayrıca `altinkaya://enclosure/{slug}` resource şablonu ve adım adım kutu seçimi için
`select_enclosure` istemi (prompt) gelir.

> [!IMPORTANT]
> Listelenen ölçüler **dış** ölçülerdir. Kullanılabilir iç hacim daha küçüktür; PCB ölçüsüne
> karar vermeden önce teknik çizimi (`get_cad_files`) kontrol edin.

## Elle kurulum

Sunucu `npx -y altinkaya-mcp` ile çalışır. Çoğu istemci için aynı JSON yeterlidir:

```json
{
  "mcpServers": {
    "altinkaya": { "command": "npx", "args": ["-y", "altinkaya-mcp"] }
  }
}
```

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add altinkaya -- npx -y altinkaya-mcp
```

</details>

<details>
<summary><b>Claude Desktop (elle)</b></summary>

Ayarlar → Geliştirici → Yapılandırmayı düzenle; yukarıdaki JSON'u `claude_desktop_config.json`
dosyasına ekleyin ve Claude Desktop'ı yeniden başlatın.

</details>

<details>
<summary><b>Codex CLI</b></summary>

```bash
codex mcp add altinkaya -- npx -y altinkaya-mcp
```

</details>

<details>
<summary><b>Gemini CLI</b></summary>

```bash
gemini mcp add altinkaya npx -y altinkaya-mcp
```

</details>

<details>
<summary><b>VS Code (elle)</b></summary>

```bash
code --add-mcp '{"name":"altinkaya","command":"npx","args":["-y","altinkaya-mcp"]}'
```

</details>

<details>
<summary><b>Cursor, Windsurf, Cline, Zed ve diğerleri</b></summary>

Yukarıdaki JSON'u istemcinin MCP ayarlarına ekleyin (`~/.cursor/mcp.json`,
`~/.codeium/windsurf/mcp_config.json`, Cline'da _MCP Servers → Configure_ veya Zed'in
`context_servers` ayarı).

</details>

<details>
<summary><b>Docker</b></summary>

```bash
docker run -i --rm ghcr.io/amazeng-co/altinkaya-mcp
```

</details>

<details>
<summary><b>Streamable HTTP</b></summary>

```bash
npx -y altinkaya-mcp --http --port 3000      # http://127.0.0.1:3000/mcp
```

Herkese açık bir kurulumda `0.0.0.0` adresine bağlayın ve genel host adlarını
`ALTINKAYA_MCP_ALLOWED_HOSTS` ile verin (DNS rebinding'e karşı diğer host'lara gelen istekler
reddedilir).

</details>

## Ayarlar

| Değişken                      | Varsayılan                          | Açıklama                                                                 |
| ----------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| `ALTINKAYA_MCP_OFFLINE`       | yok                                 | `1` = hiç indirme yapma; önbellekteki veya paketle gelen kataloğu kullan |
| `ALTINKAYA_MCP_CACHE_DIR`     | işletim sisteminin önbellek klasörü | İndirilen kataloğun saklandığı yer                                       |
| `ALTINKAYA_MCP_CATALOG_URL`   | bu reponun GitHub'daki dosyası      | İndirilecek katalog dosyası                                              |
| `ALTINKAYA_MCP_ALLOWED_HOSTS` | localhost                           | `--http` modunda kabul edilen host adları                                |

## Nasıl çalışır?

Altınkaya'nın herkese açık bir API'si olmadığı için katalog yaklaşık ayda bir altinkaya.com'dan
taranır ([CONTRIBUTING](CONTRIBUTING.md#catalog-data)) ve [`data/catalog.json`](data/catalog.json)
dosyasına yazılır. Sunucu açılışta güncel dosyayı GitHub'dan ister (değişmediyse hiçbir şey
indirilmez), önbelleğe yazar; internet yoksa önbellekteki veya paketle gelen kopyayı kullanır.
Tüm arama bellekte yapılır. Fiyat ve stok bilgisi içermez.

## Geliştirme

[CONTRIBUTING.md](CONTRIBUTING.md) ve [yol haritası](ROADMAP.md) (İngilizce).

## Sorumluluk reddi

Bu resmi olmayan bir topluluk projesidir; Altınkaya Elektronik Cihaz Kutuları San. Tic. A.Ş.
ile bağlantılı değildir. Ürün verileri Altınkaya'ya aittir; üretimden önce ölçüleri her zaman
resmi teknik çizimlerden doğrulayın.

## Lisans

[MIT](LICENSE)
