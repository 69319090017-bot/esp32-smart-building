// provinces.h - Thailand 77 Provinces Geolocation Database (PROGMEM) & WMO Weather Codes
#pragma once

#include <Arduino.h>

struct ProvinceInfo {
    const char* nameTh;
    const char* nameEn;
    float lat;
    float lon;
};

// All 77 Provinces of Thailand
constexpr ProvinceInfo PROVINCES[] = {
    {"กรุงเทพมหานคร", "Bangkok", 13.7563f, 100.5018f},
    {"นนทบุรี", "Nonthaburi", 13.8591f, 100.5217f},
    {"ปทุมธานี", "Pathum Thani", 14.0208f, 100.5250f},
    {"สมุทรปราการ", "Samut Prakan", 13.5991f, 100.5968f},
    {"สมุทรสาคร", "Samut Sakhon", 13.5475f, 100.2744f},
    {"สมุทรสงคราม", "Samut Songkhram", 13.4098f, 99.9994f},
    {"นครปฐม", "Nakhon Pathom", 13.8196f, 100.0443f},
    {"พระนครศรีอยุธยา", "Phra Nakhon Si Ayutthaya", 14.3532f, 100.5684f},
    {"อ่างทอง", "Ang Thong", 14.5896f, 100.4550f},
    {"ลพบุรี", "Lopburi", 14.7995f, 100.6534f},
    {"สิงห์บุรี", "Sing Buri", 14.8911f, 100.4046f},
    {"ชัยนาท", "Chai Nat", 15.1852f, 100.1252f},
    {"สระบุรี", "Saraburi", 14.5289f, 100.9108f},
    {"ชลบุรี", "Chonburi", 13.3611f, 100.9847f},
    {"ระยอง", "Rayong", 12.6814f, 101.2816f},
    {"จันทบุรี", "Chanthaburi", 12.6114f, 102.1039f},
    {"ตราด", "Trat", 12.2428f, 102.5170f},
    {"ฉะเชิงเทรา", "Chachoengsao", 13.6904f, 101.0780f},
    {"ปราจีนบุรี", "Prachinburi", 14.0510f, 101.3725f},
    {"นครนายก", "Nakhon Nayok", 14.2069f, 101.2131f},
    {"สระแก้ว", "Sa Kaeo", 13.8140f, 102.0718f},
    {"นครราชสีมา", "Nakhon Ratchasima", 14.9799f, 102.0978f},
    {"บุรีรัมย์", "Buriram", 14.9930f, 103.1029f},
    {"สุรินทร์", "Surin", 14.8818f, 103.4936f},
    {"ศรีสะเกษ", "Sisaket", 15.1186f, 104.3220f},
    {"อุบลราชธานี", "Ubon Ratchathani", 15.2448f, 104.8473f},
    {"ยโสธร", "Yasothon", 15.7926f, 104.1451f},
    {"ชัยภูมิ", "Chaiyaphum", 15.8063f, 102.0315f},
    {"อำนาจเจริญ", "Amnat Charoen", 15.8584f, 104.6258f},
    {"บึงกาฬ", "Bueng Kan", 18.3609f, 103.6465f},
    {"หนองบัวลำภู", "Nong Bua Lamphu", 17.2034f, 102.4407f},
    {"ขอนแก่น", "Khon Kaen", 16.4419f, 102.8359f},
    {"อุดรธานี", "Udon Thani", 17.4138f, 102.7872f},
    {"เลย", "Loei", 17.4860f, 101.7223f},
    {"หนองคาย", "Nong Khai", 17.8783f, 102.7420f},
    {"มหาสารคาม", "Maha Sarakham", 16.1850f, 103.3007f},
    {"ร้อยเอ็ด", "Roi Et", 16.0538f, 103.6520f},
    {"กาฬสินธุ์", "Kalasin", 16.4322f, 103.5066f},
    {"สกลนคร", "Sakon Nakhon", 17.1546f, 104.1486f},
    {"นครพนม", "Nakhon Phanom", 17.3998f, 104.7695f},
    {"มุกดาหาร", "Mukdahan", 16.5436f, 104.7235f},
    {"เชียงใหม่", "Chiang Mai", 18.7883f, 98.9853f},
    {"ลำพูน", "Lamphun", 18.5745f, 99.0087f},
    {"ลำปาง", "Lampang", 18.2888f, 99.4928f},
    {"อุตรดิตถ์", "Uttaradit", 17.6201f, 100.0993f},
    {"แพร่", "Phrae", 18.1446f, 100.1410f},
    {"น่าน", "Nan", 18.7838f, 100.7782f},
    {"พะเยา", "Phayao", 19.1664f, 99.9022f},
    {"เชียงราย", "Chiang Rai", 19.9072f, 99.8325f},
    {"แม่ฮ่องสอน", "Mae Hong Son", 19.3020f, 97.9654f},
    {"นครสวรรค์", "Nakhon Sawan", 15.7051f, 100.1378f},
    {"อุทัยธานี", "Uthai Thani", 15.3835f, 100.0245f},
    {"กำแพงเพชร", "Kamphaeng Phet", 16.4828f, 99.5227f},
    {"ตาก", "Tak", 16.8839f, 99.1258f},
    {"สุโขทัย", "Sukhothai", 17.0056f, 99.8264f},
    {"พิษณุโลก", "Phitsanulok", 16.8211f, 100.2659f},
    {"พิจิตร", "Phichit", 16.4429f, 100.3490f},
    {"เพชรบูรณ์", "Phetchabun", 16.4190f, 101.1561f},
    {"สุพรรณบุรี", "Suphan Buri", 14.4745f, 100.1177f},
    {"กาญจนบุรี", "Kanchanaburi", 14.0228f, 99.5328f},
    {"ราชบุรี", "Ratchaburi", 13.5360f, 99.8174f},
    {"เพชรบุรี", "Phetchaburi", 13.1110f, 99.9398f},
    {"ประจวบคีรีขันธ์", "Prachuap Khiri Khan", 11.8124f, 99.7973f},
    {"นครศรีธรรมราช", "Nakhon Si Thammarat", 8.4304f, 99.9631f},
    {"กระบี่", "Krabi", 8.0863f, 98.9063f},
    {"พังงา", "Phang Nga", 8.4501f, 98.5255f},
    {"ภูเก็ต", "Phuket", 7.8804f, 98.3923f},
    {"สุราษฎร์ธานี", "Surat Thani", 9.1382f, 99.3215f},
    {"ระนอง", "Ranong", 9.9658f, 98.6348f},
    {"ชุมพร", "Chumphon", 10.4930f, 99.1800f},
    {"สงขลา", "Songkhla", 7.1988f, 100.5954f},
    {"สตูล", "Satun", 6.6238f, 100.0674f},
    {"ตรัง", "Trang", 7.5563f, 99.6114f},
    {"พัทลุง", "Phatthalung", 7.6167f, 100.0740f},
    {"ปัตตานี", "Pattani", 6.8696f, 101.2501f},
    {"ยะลา", "Yala", 6.5411f, 101.2813f},
    {"นราธิวาส", "Narathiwat", 6.4255f, 101.8253f}
};

constexpr size_t TOTAL_PROVINCES = sizeof(PROVINCES) / sizeof(PROVINCES[0]);

inline const ProvinceInfo* getProvinceByIndex(size_t index) {
    if (index >= TOTAL_PROVINCES) return &PROVINCES[0];
    return &PROVINCES[index];
}

inline const ProvinceInfo* findProvinceByName(const char* name) {
    if (!name) return &PROVINCES[0];
    for (size_t i = 0; i < TOTAL_PROVINCES; ++i) {
        if (strcmp(PROVINCES[i].nameTh, name) == 0 || strcasecmp(PROVINCES[i].nameEn, name) == 0) {
            return &PROVINCES[i];
        }
    }
    return &PROVINCES[0]; // fallback to Bangkok
}

// WMO Weather Interpretation Codes translation to Thai
inline const char* getWmoDescriptionThai(int code) {
    switch (code) {
        case 0: return "ท้องฟ้าแจ่มใส";
        case 1: return "ท้องฟ้าโปร่งเป็นส่วนใหญ่";
        case 2: return "มีเมฆเป็นบางส่วน";
        case 3: return "มีเมฆมาก";
        case 45: return "หมอกหนา";
        case 48: return "หมอกน้ำค้างแข็ง";
        case 51: return "ฝนละอองเบาบาง";
        case 53: return "ฝนละอองปานกลาง";
        case 55: return "ฝนละอองหนาแน่น";
        case 61: return "ฝนตกเล็กน้อย";
        case 63: return "ฝนตกปานกลาง";
        case 65: return "ฝนตกหนัก";
        case 80: return "ฝนซู่ตกเล็กน้อย";
        case 81: return "ฝนซู่ตกปานกลาง";
        case 82: return "ฝนซู่ตกหนักรุนแรง";
        case 95: return "พายุฝนฟ้าคะนอง";
        case 96: return "พายุฝนฟ้าคะนองพร้อมลูกเห็บเบา";
        case 99: return "พายุฝนฟ้าคะนองรุนแรงพร้อมลูกเห็บ";
        default: return "สภาพอากาศแปรปรวน";
    }
}
