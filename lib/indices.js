/**
 * TC-S Daily Indices Brief Data Model
 * Defines the 6 core indices for the Current-See platform
 */

class TCSIndex {
  constructor(id, name, unit, value, description) {
    this.id = id;
    this.name = name;
    this.unit = unit;
    this.value = value;
    this.description = description;
    this.asOf = new Date().toISOString();
  }
}

class SolarSignals {
  constructor(production, consumption) {
    this.production = production;
    this.consumption = consumption;
  }
}

class DailyBrief {
  constructor(date, indices, solar) {
    this.date = date;
    this.indices = indices;
    this.solar = solar;
  }

  toJSON() {
    return {
      date: this.date,
      indices: this.indices,
      solar: this.solar
    };
  }

  toJSONLD() {
    return {
      "@context": "https://schema.org",
      "@type": "DataSet",
      "name": "TC-S Daily Indices Brief",
      "description": "Daily briefing of TC-S core performance indices",
      "datePublished": this.date,
      "distribution": this.indices.map(idx => ({
        "@type": "DataDownload",
        "name": idx.name,
        "encodingFormat": "application/json",
        "description": idx.description,
        "contentUrl": `https://api.thecurrentsee.org/api/daily-brief#${idx.id}`,
        "value": idx.value,
        "unit": idx.unit
      }))
    };
  }
}

module.exports = {
  TCSIndex,
  SolarSignals,
  DailyBrief
};
