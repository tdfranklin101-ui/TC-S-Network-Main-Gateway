module.exports = {
  domainAgents: {
    identifyAnything: {
      capabilities: ['price.artifact'],
      description: 'Valuation Agent'
    },
    seismicID: {
      capabilities: ['analyze.risk'],
      description: 'Seismic Risk Agent'
    },
    satelliteID: {
      capabilities: ['observe.telemetry'],
      description: 'Global Sensor Agent'
    },
    zPrivate: {
      capabilities: ['commission.project'],
      description: 'Commissioning Agent'
    }
  }
};
