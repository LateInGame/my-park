import { Controller } from "@hotwired/stimulus"
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder"
import { end } from "@popperjs/core";


export default class extends Controller {
  static values = {
    apiKey: String,
    markers: Array
  }
  static targets = [ "instructions", "map"]
  connect() {

    // connect car

    mapboxgl.accessToken = this.apiKeyValue

    this.map = new mapboxgl.Map({
      container: this.mapTarget,
      style: "mapbox://styles/mapbox/dark-v11"
      // style: "mapbox://styles/lateingame/clb28me8n003h14pprlv7piz9"
    })


    this.#addMarkersToMap()
    this.#addCarMarkerToMap()
    this.#showCar()

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
        // event.preventDefault();
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

        newMarker.getElement().addEventListener("click", (event) => {
          this.instructionsTarget.querySelector(".street-availability").innerHTML = `Occupation: ${marker.availability}%`
          this.instructionsTarget.querySelector(".park-form")
          .innerHTML = marker.counter_btn
          this.instructionsTarget.querySelector("form").addEventListener("submit", (event) => {
            event.preventDefault()
            fetch(event.currentTarget.action + "/?" + new URLSearchParams({
              lng: marker.lng,
              lat: marker.lat
            }), {
              method: "POST",
              body: new FormData(event.currentTarget)
            })
          })
        })
      })

    }
    // RETURN TO CAR BUTTON STARTS HEERE -- WARNING -- FATAL DANGER

    #addCarMarkerToMap() {

      const carButton = document.querySelector('.fa-solid.fa-car');
      carButton.addEventListener('click',() => {
              // console.log("oiiiii")
              // this.markersValue.forEach((marker) => {
                const customMarker = document.createElement("div")
                customMarker.className = "marker"
                //customMarker.style.backgroundImage = `url('${marker.image_url}')`
                customMarker.style.backgroundSize = "contain"
                customMarker.style.width = "25px"
                customMarker.style.height = "25px"
                //this.showCar(customMarker)

              })
            }

    #showCar(customMarker) {
      const newMarker = new mapboxgl.Marker(customMarker)
      // this.footersTarget.querySelector('.fa-solid.fa-car')
      .setLngLat({lng: -8.693849017008867, lat: 41.68360733974835})
      .addTo(this.map)
    }
      #fitMapToMarkers(coords) {
        const bounds = new mapboxgl.LngLatBounds()
        bounds.extend(coords)
        this.map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 150 })
      }
    }
