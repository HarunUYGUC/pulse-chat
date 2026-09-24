# PulseChat — Mimari Notlar ve Mühendislik Kararları (Engineering Deep Dive)

Bu doküman; **PulseChat** projesinin mimari tasarım sürecinde alınan kritik yazılım mühendisliği kararlarını, veri modellerini, bileşen hiyerarşisini, gerçek zamanlı haberleşme kalıplarını ve durum yönetimi stratejilerini detaylandıran kapsamlı teknik referanstır.

> 🌐 **Dil / Language:** 🇹🇷 **Türkçe** | [🇬🇧 English Version](ARCHITECTURE_NOTES.md)

---

## İçindekiler
1. [Veri ve Tip Mühendisliği (Data & Type Engineering)](#1-veri-ve-tip-mühendisliği-data--type-engineering)
   - [1.1 Cross-Stack Serialization ve Savunmacı Tipler (Defensive Typings)](#11-cross-stack-serialization-ve-savunmacı-tipler-defensive-typings)
   - [1.2 DTO Flattening: `senderId` vs. `senderUsername` (İlişkisel Bütünlük vs. UI Performansı)](#12-dto-flattening-senderid-vs-senderusername-ilişkisel-bütünlük-vs-ui-performansı)
   - [1.3 Generic Tipler ile Uçtan Uca Tip Güvenliği (`api.get<Channel[]>`)](#13-generic-tipler-ile-uçtan-uca-tip-güvenliği-apigetchannel)
   - [1.4 Global vs. Dosyaya Özel (Local) Tip Ayrımı](#14-global-vs-dosyaya-özel-local-tip-ayrımı)
   - [1.5 TypeScript Union Tipleri ve Null Güvenliği (`useState<string | null>(null)`)](#15-typescript-union-tipleri-ve-null-güvenliği-usestatestring--nullnull)
2. [Bileşen ve Yerleşim Mimarisi (Component Hierarchy & Layout)](#2-bileşen-ve-yerleşim-mimarisi-component-hierarchy--layout)
   - [2.1 Üç Kolonlu Esnek Yerleşim (Flexbox Layout: Sidebar, Canvas, Members)](#21-üç-kolonlu-esnek-yerleşim-flexbox-layout-sidebar-canvas-members)
   - [2.2 Modal Yaşam Döngüsü ve Konumlandırma (`isOpen`, `onClose: () => void`)](#22-modal-yaşam-döngüsü-ve-konumlandırma-isopen-onclose---void)
   - [2.3 Kısa Devre Koşullu Render (`{isMembersOpen && !isDm && <MembersSidebar />}`)](#23-kısa-devre-koşullu-render-ismembersopen--isdm--memberssidebar-)
   - [2.4 React Sentetik Form Olayları (`React.FormEvent` & `e.preventDefault()`)](#24-react-sentetik-form-olayları-reactformevent--epreventdefault)
3. [Veritabanı ve API Mimarisi (Database & API Architecture)](#3-veritabanı-ve-api-mimarisi-database--api-architecture)
   - [3.1 Kişiye Özel Veriler vs. Genel Veriler (Join Table & Contextual DTO)](#31-kişiye-özel-veriler-vs-genel-veriler-join-table--contextual-dto)
   - [3.2 Sorumluluk Sınırı (Separation of Concerns) ve API Sözleşmesi](#32-sorumluluk-sınırı-separation-of-concerns-ve-api-sözleşmesi)
   - [3.3 SQLite Dinamik Şema Kontrolü (`PRAGMA table_info`)](#33-sqlite-dinamik-şema-kontrolü-pragma-table_info)
   - [3.4 Veritabanı Varlığı vs. Statik UI Kararı (Neden Kanallar Buton Olarak Kodlanmadı?)](#34-veritabanı-varlığı-vs-statik-ui-kararı-neden-kanallar-buton-olarak-kodlanmadı)
4. [Durum Yönetimi ve React Prensipleri (State & Store Design)](#4-durum-yönetimi-ve-react-prensipleri-state--store-design)
   - [4.1 Tek Yönlü Veri Akışı, Durumu Yukarı Taşıma (Lifting State Up) ve 3 Kademeli Durum Matrisi](#41-tek-yönlü-veri-akışı-durumu-yukarı-taşıma-lifting-state-up-ve-3-kademeli-durum-matrisi)
   - [4.2 Tip Tanımı (Interface) vs. Çalışma Zamanı Başlangıç Değeri (Initial State)](#42-tip-tanımı-interface-vs-çalışma-zamanı-başlangıç-değeri-initial-state)
   - [4.3 React Hook İsimlendirme Konvansiyonu (`useChatStore`)](#43-react-hook-isimlendirme-konvansiyonu-usechatstore)
5. [Gerçek Zamanlı Ağ ve Protokol Mimarisi (Networking & Protocols)](#5-gerçek-zamanlı-ağ-ve-protokol-mimarisi-networking--protocols)
   - [5.1 HTTP REST vs. SignalR (WebSockets) Rol Ayrımı](#51-http-rest-vs-signalr-websockets-rol-ayrımı)
   - [5.2 Geliştirme Ortamında CORS ve Vite Reverse Proxy Çözümü](#52-geliştirme-ortamında-cors-ve-vite-reverse-proxy-çözümü)
   - [5.3 Zaman Damgaları: UTC Depolama ve İstemci Taraflı Formatlama](#53-zaman-damgaları-utc-depolama-ve-istemci-taraflı-formatlama)
6. [Stil Stratejisi ve Dağıtım Yol Haritası (Styling & Deployment)](#6-stil-stratejisi-ve-dağıtım-yol-haritası-styling--deployment)
   - [6.1 Hibrit Stil Stratejisi: Bootstrap 5 + Scoped Custom CSS (NPM vs CDN)](#61-hibrit-stil-stratejisi-bootstrap-5--scoped-custom-css-npm-vs-cdn)
   - [6.2 Canlıya Alma (Production Deployment) Mimarisi](#62-canlıya-alma-production-deployment-mimarisi)

---

## 1. Veri ve Tip Mühendisliği (Data & Type Engineering)

### 1.1 Cross-Stack Serialization ve Savunmacı Tipler (Defensive Typings)

* **Problem:** C# .NET ekosisteminde nesne property'leri geleneksel olarak **PascalCase** (`ChannelId`, `IsDirectMessage`), JavaScript/TypeScript dünyasında ise **camelCase** (`channelId`, `isDirectMessage`) yazılır. REST API controller'ları varsayılan olarak camelCase dönüşümü yaparken; SignalR üzerinden canlı aktarılan raw DTO'lar veya websocket paketleri zaman zaman PascalCase olarak kalabilir.
* **Çözüm:** `frontend/src/types/index.ts` dosyasında çift uyumlu savunmacı tipler tanımlanmıştır:
  ```typescript
  export interface Message {
    id: number;
    content: string;
    channelId: number;   // Standart REST API (camelCase)
    ChannelId?: number;  // Fallback opsiyonel (SignalR / PascalCase)
    senderId: number;
    senderUsername: string;
  }
  ```
* **Store Tüketimi:** [chatStore.ts](file:///c:/Users/harun/Documents/antigravity/pulse-chat/frontend/src/store/chatStore.ts#L198) içinde güvenli okuma:
  ```typescript
  const msgChannelId = Number(
    message.channelId || (message as unknown as { ChannelId: number }).ChannelId
  );
  ```
  Bu desen, veri hangi formatta gelirse gelsin uygulamanın çökmesini (`undefined` hatalarını) önler.

---

### 1.2 DTO Flattening: `senderId` vs. `senderUsername` (İlişkisel Bütünlük vs. UI Performansı)

Neden tek bir mesajda hem `senderId: number` hem `senderUsername: string` taşınır?
1. **`senderId` (İlişkisel Kimlik & Güvenlik):** Veritabanındaki `Users` tablosunun değişmez `Primary Key`'idir. Kullanıcı adını gelecekte değiştirse bile bu kimlik sabittir. Ekranda *"Bu mesaj bana mı ait? (silme/düzenleme butonunu göster, okunmamış çizgisini çekme)"* kontrolü `currentUser.id === message.senderId` ile yapılır.
2. **`senderUsername` (DTO Flattening & N+1 Sorgu Engelleme):** Ekranda her mesaj balonunun üstünde kullanıcı adı ve avatar gösterilmelidir. Eğer sadece `senderId: 42` gelseydi, frontend her mesaj için ek bir `GET /api/users/42` isteği atmak zorunda kalırdı (**N+1 Query Problemi**). Backend, DTO oluştururken kullanıcı adını mesaja düzleştirerek iliştirir (`DTO Flattening`). Böylece sıfır ek istek ile anında render sağlanır.

---

### 1.3 Generic Tipler ile Uçtan Uca Tip Güvenliği (`api.get<Channel[]>`)

```typescript
const response = await api.get<Channel[]>('/channels');
```
* Axios varsayılan olarak API yanıtlarını `any` (tip denetimi yok) döndürür.
* `<Channel[]>` generic parametresi verilerek derleyiciye yanıtın `Channel` nesnelerinden oluşan bir liste olduğu bildirilir.
* Geliştirici yanlışlıkla `c.name` yerine `c.nmae` yazarsa derleme anında kırmızı hata verilir; çalışma anında (runtime) hata çıkması engellenir.

---

### 1.4 Global vs. Dosyaya Özel (Local) Tip Ayrımı

Projede tipler **kullanım kapsamına (scope)** göre organize edilir:
* **Global Tipler (`src/types/index.ts`):** Projenin ana aktörleridir (`User`, `Channel`, `Message`, `AuthResponse`). 2 veya daha fazla dosya tarafından ortak tüketilen modeller merkezi dosyada `export` edilir.
* **Local Tipler:** Sadece o bileşenin girdilerini tanımlayan `Props` interface'leri (`ChatHeaderProps`, `MessageItemProps`) veya geçici form hata state'leri (`interface FormErrors`) ilgili bileşenin kendi `.tsx` dosyasında kalır.

---

### 1.5 TypeScript Union Tipleri ve Null Güvenliği (`useState<string | null>(null)`)

```typescript
const [error, setError] = useState<string | null>(null);
```
* Bir form hata mesajı başlangıçta yoktur (`null`), hata olduğunda ise metindir (`string`).
* `<string | null>` generic union tipi ile TypeScript'e değişkenin sadece bu iki durumdan birinde olabileceği garanti edilir. Böylece hem `error.toUpperCase()` gibi güvensiz çağrılar engellenir hem de tip bütünlüğü korunur.

---

## 2. Bileşen ve Yerleşim Mimarisi (Component Hierarchy & Layout)

### 2.1 Üç Kolonlu Esnek Yerleşim (Flexbox Layout: Sidebar, Canvas, Members)

PulseChat arayüzü, Discord ve Slack tarzı modern **3-kolonlu CSS Flexbox** mimarisi üzerine kurulmuştur:

```
┌─────────────────┬──────────────────────────────────┬─────────────────┐
│                 │            ChatHeader            │                 │
│                 ├──────────────────────────────────┤                 │
│  Sidebar (Nav)  │        MessageList (Scroll)      │ MembersSidebar  │
│  Channels & DMs │                                  │ (Online/Offline)│
│  (width: 260px) ├──────────────────────────────────┤ (width: 240px)  │
│                 │   TypingIndicator & MessageInput │                 │
└─────────────────┴──────────────────────────────────┴─────────────────┘
```

1. **`Sidebar` (`260px`, sabit genişlik):** Sunucu kanallarını, özel mesajları (DM) ve profil kartını barındırır (`flex-shrink: 0`).
2. **`chat-main` (`flex: 1`, dinamik genişleyen merkez tuval):** Kendi içinde dikey flex (`flex-direction: column`) olarak düzenlenir. Üstte başlık (`ChatHeader`), ortada taşan mesaj akışı (`flex: 1; overflow-y: auto;`), altta giriş kutusu (`MessageInput`).
3. **`MembersSidebar` (`240px`, sağ panel):** Kanal üyelerini çevrimiçi/çevrimdışı gruplarında listeler; açılıp kapanabilir.

---

### 2.2 Modal Yaşam Döngüsü ve Konumlandırma (`isOpen`, `onClose: () => void`)

Modal bileşenlerinde (`CreateChannelModal`, `InviteMembersModal`, `BrowseChannelsModal`):
* **Durum Ebeveyndedir:** Modalın açık veya kapalı olduğu bilgisi (`showModal: boolean`) ve kapatma fonksiyonu ebeveyn bileşendedir.
* **Callback İletimi:** Ebeveyn, çocuğa `onClose: () => void` prop'unu aktarır. Modal içindeki "İptal" veya "X" butonu bu callback'i tetikler.
* **Ekran Ortalaması:** Modal'ın ekranda doğru yerde belirmesi, CSS `position: fixed`, `top: 0; left: 0; width: 100vw; height: 100vh;`, `z-index: 1050;` ve Bootstrap `modal-dialog-centered` sınıflarıyla sağlanır.

---

### 2.3 Kısa Devre Koşullu Render (`{isMembersOpen && !isDm && <MembersSidebar />}`)

[AppLayout.tsx](file:///c:/Users/harun/Documents/antigravity/pulse-chat/frontend/src/components/layout/AppLayout.tsx#L82) içerisindeki koşullu render:
* Sağ panel sadece kullanıcı paneli açık tutuyorsa (`isMembersOpen === true`) **VE** bulunulan kanal bir Direkt Mesaj (DM) değilse (`!isDm`) DOM'a basılır.
* Birebir DM görüşmelerinde üyeler paneli anlamsız olduğundan koşul `false` üretir ve React bileşeni render etmeyerek arayüz alanını merkeze bırakır.

---

### 2.4 React Sentetik Form Olayları (`React.FormEvent` & `e.preventDefault()`)

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  ...
};
```
* HTML formları `submit` edildiğinde varsayılan olarak tarayıcıyı yenileyip sayfayı yeniden yüklemeye çalışır.
* Tek Sayfa Uygulamalarında (SPA) `e.preventDefault()` çağrılarak bu varsayılan davranış engellenir; veri arka planda asenkron olarak Axios üzerinden API'ye iletilir.

---

## 3. Veritabanı ve API Mimarisi (Database & API Architecture)

### 3.1 Kişiye Özel Veriler vs. Genel Veriler (Join Table & Contextual DTO)

* **Problem:** Kanalın `name` ve `description` alanları herkes için aynı iken; `unreadCount`, `lastReadMessageId` ve `isMember` alanları oturum açmış kullanıcıya özeldir.
* **Veritabanı Çözümü:** `Channels` tablosunda `unreadCount` diye bir sütun **yoktur**. Kullanıcı ile kanal arasındaki ilişki `ChannelMember` tablosunda tutulur:
  ```csharp
  // backend/Models/ChannelMember.cs
  public class ChannelMember {
      public int ChannelId { get; set; }
      public int UserId { get; set; }
      public int? LastReadMessageId { get; set; } // O kullanıcının okuduğu son mesaj ID'si
      public DateTime? LastReadAt { get; set; }
  }
  ```
* **Dinamik DTO Hesaplaması:** `ChannelsController.cs` istek anında token'daki `currentUserId`ye bakar; kullanıcının `LastReadMessageId` değerinden büyük mesaj sayısını hesaplar ve istemciye kişiselleştirilmiş `ChannelDto` döner.

---

### 3.2 Sorumluluk Sınırı (Separation of Concerns) ve API Sözleşmesi

* **Backend Sorumluluğu:** Tablo tasarımı, foreign key ilişkileri, veritabanı indeksleri ve SQL `JOIN` işlemleri %100 backend katmanına aittir.
* **Frontend Sorumluluğu:** Veritabanı yapısını bilmez; yalnızca sunulan **API Sözleşmesi (API Contract / Swagger)** doğrultusunda JSON paketlerini tüketir.

---

### 3.3 SQLite Dinamik Şema Kontrolü (`PRAGMA table_info`)

[backend/Program.cs](file:///c:/Users/harun/Documents/antigravity/pulse-chat/backend/Program.cs#L187) içinde bulunan `EnsureColumnExists` fonksiyonu:
* SQLite veritabanlarında `PRAGMA table_info("TableName");` sorgusu çalıştırarak sütunların varlığını dinamik olarak denetler.
* Eksik bir sütun varsa (`ALTER TABLE ... ADD COLUMN ...`) komutunu güvenle çalıştırır. Böylece veritabanını silip baştan oluşturmaya gerek kalmadan şema güncellemeleri korunur.

---

### 3.4 Veritabanı Varlığı vs. Statik UI Kararı (Neden Kanallar Buton Olarak Kodlanmadı?)

#### Problem / Tasarım Sorusu:
Uygulama ilk açıldığında ekranda görünen `#general`, `#random`, `#dev` gibi varsayılan kanallar; veritabanına hiç bulaşmadan doğrudan frontend koduna `<button>#general</button>` şeklinde statik (hardcoded) olarak yerleştirilemez miydi? Backend'de neden Seed Data olarak tanımlandı?

#### Mimari Gerekçeler:
1. **İlişkisel Bütünlük ve Yabancı Anahtar (Foreign Key Constraint):**
   Bir kullanıcı `#general` kanalına mesaj attığında, veritabanı motoru `Messages` tablosuna `ChannelId: 1` kaydı girmeye çalışır. Eğer `Channels` tablosunda `Id: 1` olan bir satır yoksa, veritabanı `Foreign Key Constraint Violation` hatası vererek mesajı kaydetmeyi reddeder. Mesajlar, okunma bilgileri ve üyelikler ancak yaşayan bir veritabanı varlığına bağlanabilir.
2. **Çoklu İstemci ve Tek Doğruluk Kaynağı (Single Source of Truth):**
   Yarın PulseChat için bir Mobil Uygulama (React Native/Flutter) veya Masaüstü İstemcisi geliştirildiğinde; kanallar veritabanında olduğu için tüm platformlar `GET /api/channels` endpoint'inden aynı dinamik listeyi çeker. Kanalları frontend'e buton olarak yazmak, her yeni istemcide kod tekrarına ve veri tutarsızlığına yol açardı.
3. **Seed Veri vs. Statik UI Karar Matrisi:**

| Karar Kriteri | Evet ise $\rightarrow$ **Veritabanı / Seed Verisi** | Hayır ise $\rightarrow$ **Statik UI / Buton** |
| :--- | :--- | :--- |
| **Bu nesneye bağlı başka veriler birikecek mi?** | **Evet:** Kanalın arkasında mesajlar, üyeler, okunma bilgileri birikir. (`Channels`) | **Hayır:** "Karanlık Mod" butonu arkasında ilişkisel veri birikmez, sadece UI durumunu değiştirir. |
| **Bu veri tüm kullanıcılar arasında paylaşılıyor mu?** | **Evet:** Ahmet'in `#general`'a yazdığı mesajı Mehmet de aynı kanalda görmelidir. | **Hayır:** "Sidebar'ı Daralt/Genişlet" butonu yalnızca o anki kullanıcının ekranını etkiler. |
| **Bu veri zamanla çoğalabilir veya silinebilir mi?** | **Evet:** Kullanıcılar yeni kanal açabilir (`+ Create Channel`), silebilir veya güncelleyebilir. | **Hayır:** "Çıkış Yap (Logout)" butonu tektir; kullanıcılar yeni bir çıkış butonu oluşturamaz. |

---

## 4. Durum Yönetimi ve React Prensipleri (State & Store Design)

### 4.1 Tek Yönlü Veri Akışı, Durumu Yukarı Taşıma (Lifting State Up) ve 3 Kademeli Durum Matrisi

React mimarisinin temelinde **Tek Yönlü Veri Akışı (One-Way Data Flow)** prensibi yer alır:
* **Veri yukarıdan aşağıya akar** (Parent $\rightarrow$ Child: Props aracılığıyla).
* **Olaylar/Emirler aşağıdan yukarıya akar** (Child $\rightarrow$ Parent: Callback fonksiyonları aracılığıyla).

#### A. Durumu Yukarı Taşıma (Lifting State Up):
Bir veri ve onu değiştiren fonksiyon, birden fazla kardeş bileşenin ortak koordinasyonuna ihtiyaç duyuyorsa, bu durum en yakın ortak ebeveyne (Parent) çıkarılır:
* **PulseChat Örneği:** [AppLayout.tsx](file:///c:/Users/harun/Documents/antigravity/pulse-chat/frontend/src/components/layout/AppLayout.tsx) bileşeni, sağdaki üyeler panelinin açık/kapalı durumunu (`isMembersOpen`) ve onu tersine çeviren fonksiyonu (`onToggleMembers`) kendi yerel state'inde tutar.
* **Child Rolü (`ChatHeader`):** Veriyi prop olarak alır, butonun aktif rengini yakar ve tıklandığında parent'tan gelen fonksiyonu tetikler. Veriyi bizzat değiştirmez, parent'a emir iletir.

#### B. İstisna: Bileşene Özel Durumlar (Local Component State):
Eğer bir veri ve onu değiştiren fonksiyon **sadece ve sadece o çocuğun kendi içini** ilgilendiriyorsa, parent'a taşınmaz:
* **PulseChat Örneği:** [MessageItem.tsx](file:///c:/Users/harun/Documents/antigravity/pulse-chat/frontend/src/components/chat/MessageItem.tsx) içinde `const [showEmojiMenu, setShowEmojiMenu] = useState(false);` state'i bulunur.
* Bir mesajın emoji menüsünün açılıp kapanması üstteki `AppLayout`'un veya `MessageList`'in umrunda değildir. Bu yüzden veri de fonksiyon da doğrudan Child'ın kendi içinde yönetilir.

#### C. Prop Drilling vs. Global Store (Zustand):
Uygulama hiyerarşisi derinleştikçe her şeyi parent'a taşımak, veriyi kat kat aşağıya elden teslim etme zorunluluğu doğurur (**Prop Drilling**).  
PulseChat bu sorunu **Zustand (`chatStore.ts`)** ile çözer:
* `MembersSidebar`, ihtiyaç duyduğu kanal ve üye verilerini aracı ebeveynlerden (AppLayout) prop olarak almaz.
* Doğrudan merkezi Zustand store'una bağlanır (`useChatStore`) ve 0 prop ile bağımsız çalışır.

#### D. 3 Kademeli Durum Karar Matrisi:

| Kapsam / İhtiyaç | Durum Nerede Tutulmalı? | PulseChat Örneği |
| :--- | :--- | :--- |
| **Yalnızca bu tek bileşenin içini mi ilgilendiriyor?** | **Child Bileşenin Kendi İçinde** (`useState`) | `MessageItem` içindeki `showEmojiMenu` popover durumu. |
| **2 veya daha fazla kardeş bileşenin koordinasyonunu mu gerektiriyor?** | **Ortak Ebeveynde (Lifting State Up - Props)** | `AppLayout` içindeki `isMembersOpen` (hem `ChatHeader` hem `MembersSidebar` bakar). |
| **Uygulamanın genelini ve farklı sayfalarını mı ilgilendiriyor?** | **Global Store'da (Zustand)** | `channels`, `messages`, `onlineUsers`, `user` oturum bilgisi. |

---

### 4.2 Tip Tanımı (Interface) vs. Çalışma Zamanı Başlangıç Değeri (Initial State)

* `interface ChatState`: Yalnızca derleyiciye rehberlik eden kağıt üstündeki tiptir. Proje derlendiğinde **tamamen silinir**.
* `useChatStore = create(...)`: Tarayıcı RAM'inde açılan gerçek değerlerdir. `channels: []` başlangıç değeri atanmazsa değer `undefined` kalır ve ilk render'da `channels.map(...)` çağrıldığında uygulama beyaz ekrana düşüp çöker.

---

### 4.3 React Hook İsimlendirme Konvansiyonu (`useChatStore`)

* React kuralları gereği durum barındıran veya state dinleyen her custom hook'un adı **`use` ile başlamak zorundadır**.
* Modülün kendisi bir durum deposu olduğu için dosya adı `chatStore.ts` olarak adlandırılmıştır.

---

## 5. Gerçek Zamanlı Ağ ve Protokol Mimarisi (Networking & Protocols)

### 5.1 HTTP REST vs. SignalR (WebSockets) Rol Ayrımı

| İşlem Tipi | Protokol | Neden? |
| :--- | :--- | :--- |
| **Login / Register / Token Doğrulama** | HTTP REST | Durumsuz (stateless), tek seferlik istek-yanıt döngüsü. |
| **Geçmiş Mesajları / Kanalları Çekme** | HTTP REST | Büyük veri paketleri ve sayfalama için en verimli yol. |
| **Canlı Mesaj Gönderimi & Emojiler** | SignalR (WebSockets) | Çift yönlü, kalıcı açık bağlantı; anında broadcast. |
| **"Yazıyor..." Bildirimi & Canlı Durum** | SignalR (WebSockets) | Milisaniye seviyesinde gecikmesiz bildirimler. |

---

### 5.2 Geliştirme Ortamında CORS ve Vite Reverse Proxy Çözümü

* **Sorun:** Frontend `5173` portunda, backend `5000` portunda çalışır. Tarayıcıların **Same-Origin Policy** güvenlik kuralı farklı portlar arasındaki doğrudan istekleri engeller.
* **Çözüm:** `vite.config.ts` içinde reverse proxy kurulmuştur:
  - Tarayıcı istekleri kendi çalıştığı `localhost:5173/api` ve `/hubs` adresine gönderir (CORS tetiklenmez).
  - Vite dev server arka planda bu istekleri şeffaf bir şekilde `localhost:5000` adresine yönlendirir.

---

### 5.3 Zaman Damgaları: UTC Depolama ve İstemci Taraflı Formatlama

* **Veritabanı Kuralı:** Mesajların zamanı daima **UTC** formatında kaydedilir (`DateTime.UtcNow`). Bu kural sunucunun veya istemcilerin farklı coğrafi saat dilimlerinde olması kaynaklı karışıklıkları sıfırlar.
* **Arayüz Kuralı:** İstemci tarafında `new Date(utcString)` ile kullanıcının yerel saatine çevrilir ve `Today at 14:30` veya `Sep 20 at 19:45` şeklinde gösterilir.

---

## 6. Stil Stratejisi ve Dağıtım Yol Haritası (Styling & Deployment)

### 6.1 Hibrit Stil Stratejisi: Bootstrap 5 + Scoped Custom CSS (NPM vs CDN)

* **Neden Hem Bootstrap Hem Özel CSS?**  
  Bootstrap 5 genel grid yapısı, butonlar, modallar ve form bileşenleri için hızlı temel sunar; ancak Discord/Slack tarzı koyu tema (`#1e1f22`, `#2b2d31`, `#5865f2`), özel kaydırma çubukları ve mesaj balonları `style.css` ile özelleştirilmiştir.
* **Neden NPM Paketi (Yerel Kurulum)?**  
  CDN (`<script src="...">`) yerine `npm install bootstrap` tercih edilmiştir. Bu sayede:
  1. Versiyon kilitlemesi yapılır (harici CDN çökmelerinde veya güncellemede site bozulmaz).
  2. Vite bundler kullanılmayan CSS'leri eleyebilir (Tree shaking).
  3. İnternet bağlantısı olmadan da yerel geliştirme yapılabilir.

---

### 6.2 Canlıya Alma (Production Deployment) Mimarisi

PulseChat'i canlıya almak için iki ana mimari yol haritası mevcuttur:

1. **Sunucusuz / PaaS Mimarisi (Serverless / Hybrid):**
   * **Frontend:** Vercel veya Netlify (Statik SPA dağıtımı, ücretsiz CDN).
   * **Backend:** Render veya Railway (ASP.NET Core Docker container, SignalR websocket desteği).
   * **Veritabanı:** SQLite'tan yönetilen ücretsiz PostgreSQL'e geçiş (`Npgsql.EntityFrameworkCore.PostgreSQL`).
2. **Tek VPS (Self-Hosted Linux / Nginx Mimarisi):**
   * Tek bir 5$ Hetzner/DigitalOcean Ubuntu sunucusu üzerine Nginx kurulur.
   * Nginx; hem React statik dosyalarını sunar hem de `/api` ve `/hubs` isteklerini arkada `systemd` servisi olarak koşan ASP.NET Core Kestrel (port 5000) sunucusuna yönlendirir (Reverse Proxy + Let's Encrypt SSL).

---

## 7. Çapraz Platform Mobil İstemci Mimarisi (React Native & Expo)

### 7.1 Çoklu İstemci Mimarisi ve Backend Kodunda Sıfır Değişiklik
PulseChat projesinde mobil uygulamanın (`mobile/`) en önemli mimari başarısı, var olan ASP.NET Core 9 backend kodunda tek bir satır dahi değişiklik gerektirmeden çalışmasıdır:
- **Ortak API Sözleşmesi:** Mobil istemci, web tarafı ile birebir aynı REST endpoint'lerini (`/api/auth/*`, `/api/channels/*`, `/api/messages/*`) ve aynı SignalR WebSocket Hub'ını (`/hubs/chat`) kullanır.
- **Paylaşılan TypeScript Tipleri:** Domain modelleri (`User`, `Channel`, `Message`, `ReactionNotification`, `TypingNotification`), web ile mobil arasında 1:1 taşınabilirdir.
- **Dinamik Ağ Dinleme (0.0.0.0 Binding):** Kestrel sunucusu `http://0.0.0.0:5000` adresine bağlandığında hem masaüstü tarayıcısının `localhost` isteklerini hem de yerel Wi-Fi ağındaki mobil telefon ve emülatörlerin isteklerini aynı anda karşılar.

### 7.2 Dinamik Ağ Host Çözümleme (`config/env.ts`)
Mobil cihazlar geliştirme bilgisayarındaki `localhost` adresini doğrudan kendi iç adresleri sandıkları için bilgisayara ulaşamazlar:
- **Fiziksel Telefon (Expo Go):** Bilgisayarın yerel ağdaki Wi-Fi IP adresini (örn: `http://192.168.1.35:5000`) kullanır. `Constants.expoConfig?.hostUri` sayesinde bilgisayarın yerel IP'si çalışma anında dinamik olarak tespit edilir.
- **Android Emülatörü:** Sanal yönlendirici adresi olan `http://10.0.2.2:5000` adresini kullanır.
- **iOS Simülatörü:** Doğrudan `http://localhost:5000` adresine erişebilir.
- **İsteğe Bağlı Manuel Adres:** `.env` dosyasındaki `EXPO_PUBLIC_API_URL` değişkeni ile istenilen IP adresi manuel olarak sabitlenebilir.

### 7.3 Yerel Gezinme Düzeni (React Navigation 7)
- **Discord Benzeri Çekmece Menü (Drawer):** Parmak kaydırmayla açılan sol çekmece menü (`ChannelDrawerContent`), kanalları, DM listesini (çevrim içi durum noktalarıyla) ve hızlı çıkış yapma profil butonunu barındırır.
- **Yığın Gezinme (Stack):** Giriş (`LoginScreen` - 1 tıkla Alice/Bob demo girişi dahil) ve Kayıt (`RegisterScreen`) ekranlarını yönetir.
- **Dinamik Kök Yönlendirici (Root Switcher):** `authStore.isAuthenticated` durumuna göre oturum açılmış ve açılmamış ekranlar arasında pürüzsüz geçiş yapar.

### 7.4 Durum Yönetimi ve Oturum Kalıcılığı
- **AsyncStorage:** JWT token ve aktif kanal/kullanıcı bilgileri `@react-native-async-storage/async-storage` ile cihaz hafızasında güvenle saklanır; uygulama kapatılıp açıldığında oturum kaybolmaz.
- **Zustand Mobil Depoları:** `authStore.ts` ve `chatStore.ts` hafif, reaktif ve yüksek performanslı bir durum yönetimi sunar.

---

*Bu doküman, PulseChat mimarisinin modern yazılım mühendisliği prensiplerine (Clean Architecture, Type Safety, Separation of Concerns) tam uyumlu olarak inşa edildiğini gösteren teknik başvuru kaynağıdır.*

