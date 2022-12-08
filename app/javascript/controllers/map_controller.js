import { Controller } from "@hotwired/stimulus"
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder"
import { end } from "@popperjs/core";

export default class extends Controller {
  static values = {
    apiKey: String,
    markers: Array,
    carCoords: Object
  }
  static targets = [ "instructions", "map"]
  connect() {
    document.querySelector(".navbar-toggler").click()
    // CHECK USER PARK LOCATION, IF UNDEFINED, HIDES FORM
    if (this.carCoordsValue == undefined) {
      console.log(this.carCoordsValue)
      this.instructionsTarget.querySelector(".leavepark").style.display = "none"
    }
    console.log(this.carCoordsValue)
    // IF NOT NILL, IT WILL SHOW THE FORM AND SEE USER CLICK
    this.instructionsTarget.querySelector(".leavepark").style.display = "inline"
    // IF USER IS PARKED, HIDES FORM
    this.instructionsTarget.querySelector(".no-btn").addEventListener("click", (event) => {
      this.instructionsTarget.querySelector(".leavepark").style.display = "none"
    })
    // IF USER IS PARKED, REMOVES PARKING LOCATION AND HIDES FORM AGAIN
    this.instructionsTarget.querySelector(".yes-btn").addEventListener("click", (event) => {
      console.log("here")
      this.carMarker.remove()
      this.instructionsTarget.querySelector(".leavepark").style.display = "none"
    })

    mapboxgl.accessToken = this.apiKeyValue

    this.map = new mapboxgl.Map({
      container: this.mapTarget,
      style: "mapbox://styles/mapbox/dark-v11"
    })
    this.#addMarkersToMap()
    this.#addCarMarkerToMap()
    this.#showCar({lng: this.carCoordsValue.lng, lat: this.carCoordsValue.lat})
    this.map.addControl(new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl
    }))
    // Add zoom and rotation controls to the map. WORKING
    // this.map.addControl(new mapboxgl.NavigationControl());
    // ADD FIND USER TO THE MAP
    this.map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        // When active the map will receive updates to the device's location as it changes.
        trackUserLocation: true,
        // Draw an arrow next to the location dot to indicate which direction the device is heading.
        showUserHeading: true
      })
      );
      this.getUsersLocation()
  }

  //       // TENTATIVA DE NAVEGAÇÃO COMPLEXA DO MAPBOX - USER ROUTING STARTS HERE
  getUsersLocation() {
    navigator.geolocation.watchPosition((position) => {
      this.start = [position.coords.longitude, position.coords.latitude]
      this.#fitMapToMarkers(this.start)
      this.connectRoute()
    })
  }

  //       // create a function to make a directions request
  async getRoute(end) {
    // make a directions request using cycling profile
    // an arbitrary start will always be the same
    // only the end or destination will change

    const streetNameQuery = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${end[0]},${end[1]}.json?access_token=${mapboxgl.accessToken}`)
    const streetNameJson = await streetNameQuery.json()
    const streetName = streetNameJson.features[0].place_name
    this.instructionsTarget.querySelector(".street-name")
      .innerText = streetName



    const query = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${this.start[0]},${this.start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`,
      { method: 'GET' }
    );
    const json = await query.json();
    const data = json.routes[0];
    const route = data.geometry.coordinates;
    const geojson = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: route
      }
    };
    // if the route already exists on the map, we'll reset it using setData
    if (this.map.getSource('route')) {
      this.map.getSource('route').setData(geojson);
    }
    // otherwise, we'll make a new request
    else {
      this.map.addLayer({
        id: 'route',
        type: 'line',
        source: {
          type: 'geojson',
          data: geojson
        },
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3887be',
          'line-width': 5,
          'line-opacity': 0.75
        }
      });
    }
    // add turn instructions here at the end
  }

  connectRoute() {
    this.map.on('load', () => {
      // make an initial directions request that
      // starts and ends at the same location
      this.getRoute(this.start);

      // Add starting point to the map
      this.map.addLayer({
        id: 'point',
        type: 'circle',
        source: {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'Point',
                  coordinates: this.start
                }
              }
            ]
          }
        },
        paint: {
          'circle-radius': 10,
          'circle-color': '#3887be'
        }
      });
      // this is where the code from the next step will go
      this.map.on('touchend', (event) => {
        const coords = Object.keys(event.lngLat).map((key) => event.lngLat[key]);
        this.instructionsTarget.querySelector(".street-availability").innerText
        event.preventDefault();
        //   this.instructionsTarget.querySelector(".street-availability")
        //     .innerText = "marker.counter_btn"
        //   counter += 10
        // })

        // this.instructionsTarget.querySelector(".street-availability").innerHTML = " "
        const end = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: coords,
              }
            }
          ]
        };
        if (this.map.getLayer('end')) {
          this.map.getSource('end').setData(end);
        } else {
          this.map.addLayer({
            id: 'end',
            type: 'circle',
            source: {
              type: 'geojson',
              data: {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                      type: 'Point',
                      coordinates: coords
                    }
                  }
                ]
              }
            },
            paint: {
              'circle-radius': 10,
              'circle-color': '#f30'
            }
          });
        }
        this.getRoute(coords);
      });
    });
  }

  flyToCar(event) {
    event.preventDefault()
    this.map.flyTo({
      center: [this.carCoordsValue.lng, this.carCoordsValue.lat],
      essential: true
    });
  }

  #addMarkersToMap() {
    this.markersValue.forEach((marker) => {
      const popup = new mapboxgl.Popup().setHTML(marker.info_window)
      // Create a HTML element for your custom marker
      const customMarker = document.createElement("div")
      customMarker.className = "marker"
      customMarker.style.backgroundImage = `url('${marker.image_url}')`
      customMarker.style.backgroundSize = "contain"
      customMarker.style.width = "25px"
      customMarker.style.height = "25px"


      // Pass the element as an argument to the new marker
      const newMarker = new mapboxgl.Marker(customMarker)
        .setLngLat([marker.lng, marker.lat])
        // .setPopup(popup)
        .addTo(this.map)

        newMarker.getElement().addEventListener("touchend", (event) => {
          document.querySelector(".navbar-toggler").click()
          this.instructionsTarget.querySelector(".street-availability").innerHTML = `Occupation: ${marker.availability}%`
          this.instructionsTarget.querySelector(".park-form")
          .innerHTML = marker.counter_btn
          this.instructionsTarget.querySelector("form").addEventListener("submit", (event) => {
            event.preventDefault()
            this.carMarker.remove()

            fetch(event.currentTarget.action + "/?" + new URLSearchParams({
              lng: marker.lng,
              lat: marker.lat
            }), {
              headers: { "Accept": "application/json"},
              method: "POST",
              body: new FormData(event.currentTarget)
            })
            .then(response => response.json())
            .then((data) => {
              this.carCoordsValue = data
            })


            this.#showCar({
              lng: marker.lng,
              lat: marker.lat
            })
          })
        })
      })

    }
    // RETURN TO CAR BUTTON STARTS HEERE -- WARNING -- FATAL DANGER

    #addCarMarkerToMap() {

      const carButton = document.querySelector('.fa-solid.fa-car');
      carButton.addEventListener('touchend',() => {
          const customMarker = document.createElement("div")
          customMarker.className = "marker"
          //customMarker.style.backgroundImage = `url('${marker.image_url}')`
          customMarker.style.backgroundSize = "contain"
          customMarker.style.width = "25px"
          customMarker.style.height = "25px"
          //this.showCar(customMarker)
          this.instructionsTarget.querySelector(".leavepark").style.display = "inline"
        })
      }

      #showCar(coords) {
        this.carMarker = new mapboxgl.Marker(coords)
        // this.footersTarget.querySelector('.fa-solid.fa-car')
        .setLngLat(coords)
        .addTo(this.map)
        this.#fitMapToCar([coords.lng, coords.lat])
        // this.start()
        // this.connectRoute()
        // this.getRoute()
    }
    #fitMapToCar(carCoords) {
      const bounds = new mapboxgl.LngLatBounds()
      bounds.extend(carCoords)
      this.map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 150 })
    }

    #fitMapToMarkers(coords) {
      const bounds = new mapboxgl.LngLatBounds()
      bounds.extend(coords)
      this.map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 150 })
    }
 }
