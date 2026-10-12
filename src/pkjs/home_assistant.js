/* Home Assistant entity state provider for TimeStyle HA. */

var MESSAGE_KEYS = [
  { label: 'HomeAssistantLabel1', value: 'HomeAssistantValue1' },
  { label: 'HomeAssistantLabel2', value: 'HomeAssistantValue2' },
  { label: 'HomeAssistantLabel3', value: 'HomeAssistantValue3' }
];

function trimTrailingSlash(value) {
  return (value || '').replace(/\/+$/, '');
}

function shortText(value, maxLength) {
  value = String(value === undefined || value === null ? '' : value);
  return value.length > maxLength ? value.substring(0, maxLength) : value;
}

function formatEntity(entity, slot) {
  var label = window.localStorage.getItem('ha_entity_' + slot + '_label') || '';
  var value = entity.state;
  var unit = entity.attributes.unit_of_measurement || '';

  // Keep numeric sensors compact while preserving useful decimal precision.
  if (!isNaN(Number(value)) && value !== '') {
    var numeric = Number(value);
    value = Math.abs(numeric) >= 100 ? String(Math.round(numeric)) :
      String(Math.round(numeric * 10) / 10);
  }

  return {
    label: shortText(label.toUpperCase(), 4),
    value: shortText(value + unit, 11)
  };
}

function sendSlot(slot, label, value) {
  var dict = {};
  dict[MESSAGE_KEYS[slot].label] = shortText(label, 4);
  dict[MESSAGE_KEYS[slot].value] = shortText(value, 11);
  Pebble.sendAppMessage(dict,
    function () { console.log('Home Assistant widget ' + (slot + 1) + ' updated'); },
    function () { console.log('Failed to update Home Assistant widget ' + (slot + 1)); }
  );
}

function fetchSlot(slot, baseUrl, token) {
  var entityId = window.localStorage.getItem('ha_entity_' + slot + '_id');
  if (!entityId) {
    sendSlot(slot, '', 'SETUP');
    return;
  }

  var request = new XMLHttpRequest();
  request.open('GET', baseUrl + '/api/states/' + encodeURIComponent(entityId), true);
  request.setRequestHeader('Authorization', 'Bearer ' + token);
  request.setRequestHeader('Content-Type', 'application/json');
  request.timeout = 15000;
  request.onload = function () {
    if (request.status >= 200 && request.status < 300) {
      try {
        var formatted = formatEntity(JSON.parse(request.responseText), slot);
        sendSlot(slot, formatted.label, formatted.value);
      } catch (error) {
        sendSlot(slot, '', 'ERROR');
      }
    } else {
      sendSlot(slot, '', request.status === 401 ? 'AUTH' : 'ERROR');
    }
  };
  request.onerror = function () { sendSlot(slot, '', 'OFFLINE'); };
  request.ontimeout = function () { sendSlot(slot, '', 'TIMEOUT'); };
  request.send();
}

function update() {
  if (window.localStorage.getItem('disable_home_assistant') === 'yes') {
    return;
  }

  var baseUrl = trimTrailingSlash(window.localStorage.getItem('ha_url'));
  var token = window.localStorage.getItem('ha_token');
  if (!baseUrl || !token) {
    for (var slot = 0; slot < 3; slot++) {
      sendSlot(slot, '', 'SETUP');
    }
    return;
  }

  for (var i = 0; i < 3; i++) {
    fetchSlot(i, baseUrl, token);
  }
}

module.exports.update = update;
