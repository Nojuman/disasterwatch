
const getEarthquake = () => {
    const urlusgs = 'http://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson';
    $.get(`${disasterwatch_api_url}/toHTTPS?url=${urlusgs}`, (data) => {
        map.getSource('earthquakes').setData(JSON.parse(data));
    });
};

const getVolcanoes = () => {
    $.get(`${volcanoes_api_url}/api/getVolcanoes`, (data) => {
        map.getSource('volcanoes').setData(data);
    });
};

const getEONETEvents = () => {
    const eoneturl = 'http://eonet.sci.gsfc.nasa.gov/api/v2.1/events';
    $.get(`${disasterwatch_api_url}/toHTTPS?url=${eoneturl}` , (data) => {

        data = JSON.parse(data);
        const geojson = {
            'type': 'FeatureCollection',
            'features': []
        };

        for (let i = 0; i < data.events.length; i++) {
            let e = data.events[i];
            let iconName = 'marker';

            switch (e.categories[0].title) {
            case 'Volcanoes':
                iconName = 'volcano-red';
                break;
            default:
                iconName = 'marker';
            }

            if (e.geometries.length > 1) {
                for (let j = 0; j < e.geometries.length; j++) {
                    let feature = {};
                    feature.properties = {
                        'dtype': e.categories[0].title,
                        'id': e.id,
                        'description': e.description,
                        'code' : e.categories[0].id,
                        'link': e.link,
                        'sources' : JSON.stringify(e.sources),
                        'title' : e.title,
                        'icon' : iconName
                    };
                    feature.properties.date =  e.geometries[j].date;
                    feature.geometry = {'type': 'Point', 'coordinates': e.geometries[j].coordinates};
                    geojson.features.push(feature);
                }
            } else {
                let feature = {};
                feature.properties = {
                    'dtype': e.categories[0].title,
                    'id': e.id,
                    'description': e.description,
                    'code' : e.categories[0].id,
                    'link': e.link,
                    'sources' : JSON.stringify(e.sources),
                    'title' : e.title,
                    'icon' : iconName
                };
                feature.properties.date = e.geometries[0].date;
                feature.geometry = {'type': 'Point', 'coordinates': e.geometries[0].coordinates};
                geojson.features.push(feature);
            }
        }

        map.getSource('eonet').setData(geojson);
    });
};

const getL8S2Images = (feature, callback) => {

    const sat = $.map($('.disaster-images .sat-filter input:checked'), (e) => {
        return e.getAttribute('data');
    });

    const jsonRequest = {
        intersects: feature,
        date_from: '2016-01-01',
        date_to: moment.utc().format('YYYY-MM-DD'),
        limit: 2000
    };

    const results = [];

    $.ajax({
        url: sat_api_url,
        type: 'POST',
        data: JSON.stringify(jsonRequest),
        dataType: 'json',
        contentType: 'application/json'
    })
        .success((data) => {
            if (data.hasOwnProperty('errorMessage')) {
                $('.disaster-images .api-status .sat-api-status').addClass('on');
                return callback(null, undefined);
            }
            if (data.meta.found !== 0) {
                for (let i = 0; i < data.results.length; i += 1) {
                    let scene = {
                        'date': data.results[i].date,
                        'cloud': data.results[i].cloud_coverage,
                        'sat': data.results[i].satellite_name
                    };

                    if (scene.sat === 'landsat-8') {
                        scene.path = data.results[i].path.toString();
                        scene.row = data.results[i].row.toString();
                        scene.grid = data.results[i].path + '/' + data.results[i].row;
                        scene.usgsURL = data.results[i].cartURL;
                        scene.browseURL = data.results[i].browseURL.replace('http://', 'https://');
                        scene.sceneID = data.results[i].scene_id;
                        scene.productID = data.results[i].LANDSAT_PRODUCT_ID;

                        if (moment(scene.date) < moment('2017-05-01')){
                            scene.awsID = scene.sceneID.replace('LGN01', 'LGN00');
                            scene.AWSurl = `https://landsat-pds.s3.amazonaws.com/L8/${zeroPad(data.results[i].path, 3)}/${zeroPad(data.results[i].row, 3)}/${scene.awsID}/`;
                        } else {
                            scene.awsID = scene.productID;
                            scene.AWSurl = `https://landsat-pds.s3.amazonaws.com/c1/L8/${zeroPad(data.results[i].path, 3)}/${zeroPad(data.results[i].row, 3)}/${scene.awsID}/`;
                        }
                        scene.sumAWSurl = `https://landsatonaws.com/L8/${zeroPad(data.results[i].path, 3)}/${zeroPad(data.results[i].row, 3)}/${scene.awsID}/`;
                    } else {
                        scene.sceneID = data.results[i].scene_id;
                        scene.utm_zone = data.results[i].utm_zone.toString();
                        scene.grid_square = data.results[i].grid_square;
                        scene.coverage = data.results[i].data_coverage_percentage;
                        scene.latitude_band = data.results[i].latitude_band;
                        scene.path = data.results[i].aws_path.replace('tiles', '#tiles');
                        scene.AWSurl = `http://sentinel-s2-l1c.s3-website.eu-central-1.amazonaws.com/${scene.path}/`;

                        let key = s2_name_to_key(scene.sceneID);
                        scene.browseURL = `https://sentinel-s2-l1c.s3.amazonaws.com/tiles/${key}/preview.jpg`;
                        scene.grid = scene.utm_zone + scene.latitude_band + scene.grid_square;
                    }
                    results.push(scene);
                }
            }

            for (let i = 0; i < results.length; i += 1) {

                let imgMeta = results[i];
                let className;

                if (imgMeta.sat === 'landsat-8') {

                    if (sat.indexOf('landsat8') === -1) {
                        className = 'item display-none';
                    } else {
                        className = 'item';
                    }

                    $('.img-preview').append(
                        `<div sat="landsat8" img-date="${imgMeta.date}" class="${className}" onmouseover="hoverL8(${imgMeta.path},${imgMeta.row})" onmouseout="hoverL8('','')">` +
                            `<img class="img-item img-responsive lazy lazyload" data-src="${imgMeta.browseURL}">` +
                            '<div class="result-overlay">' +
                                `<span><i class="fa fa-calendar-o"></i> ${imgMeta.date}</span>` +
                                `<span><i class="fa fa-cloud"></i> ${imgMeta.cloud}%</span>` +
                                '<span>Link:</span>' +
                                `<div class="btnDD" onclick="feeddownloadL8('${imgMeta.AWSurl}','${imgMeta.awsID}')"><i class="fa fa-download"></i></div>` +
                                `<div class="btnDD" onclick="initSceneL8('${imgMeta.awsID}')"><i style="color:#FFF" class="fa fa-eye"></i></div>` +
                                `<a target="_blank" href="${imgMeta.sumAWSurl}"><img src="/img/aws.png"> </a>` +
                                `<a target="_blank" href="${imgMeta.usgsURL}"><img src="/img/usgs.jpg"></a>` +
                            '</div>' +
                        '</div>'
                    );

                } else {

                    if (sat.indexOf('sentinel2') === -1) {
                        className = 'item display-none';
                    } else {
                        className = 'item';
                    }
                    $('.img-preview').append(
                        `<div sat="sentinel2" img-date="${imgMeta.date}" class="${className}" onmouseover="hoverS2('${imgMeta.grid}')" onmouseout="hoverS2('')">` +
                            `<img class="img-item img-responsive lazy lazyload" data-src="${imgMeta.browseURL}">` +
                            '<div class="result-overlay">' +
                                `<span><i class="fa fa-calendar-o"></i> ${imgMeta.date}</span>` +
                                `<span><i class="fa fa-cloud"></i> ${imgMeta.cloud}%</span>` +
                                '<span>Link:</span>' +
                                `<div class="btnDD" onclick="feeddownloadS2('${imgMeta.sceneID}')"><i class="fa fa-download"></i></div>` +
                                `<div class="btnDD" onclick="initSceneS2('${imgMeta.sceneID}')"><i style="color:#FFF" class="fa fa-eye"></i></div>` +
                                `<a target="_blank" href="${imgMeta.AWSurl}"><img src="/img/aws.png"> </a>` +
                            '</div>' +
                        '</div>'
                    );
                }
            }

            return callback(null, results.length);
        })
        .fail(() => {
            $('.disaster-images .api-status .sat-api-status').addClass('on');
            return callback(null, undefined);
        });
};

const getS1Images = (feature, callback) => {

    const sat = $.map($('.disaster-images .sat-filter input:checked'), (e) => {
        return e.getAttribute('data');
    });

    const jsonRequest = {
        startDate: '2016-01-01',
        completionDate: moment.utc().format('YYYY-MM-DD'),
        productType: 'SLC',
        maxRecords: 200
    };

    if (feature.geometry.type === 'Point') {
        jsonRequest.lat = feature.geometry.coordinates[1];
        jsonRequest.lon = feature.geometry.coordinates[0];
    } else {
        const bbox = turf.bbox(feature);
        jsonRequest.box = bbox[0] + ',' + bbox[1] + ',' + bbox[2] + ',' + bbox[3];
    }

    $.ajax({
        url: `${disasterwatch_api_url}/getS1Images`,
        type: 'POST',
        data: JSON.stringify(jsonRequest),
        dataType: 'json',
        contentType: 'application/json'
    })
        .success((data) => {
            if (data.hasOwnProperty('errorMessage')) {
                $('.disaster-images .api-status .peps-status').addClass('on');
                return callback(null, undefined);
            }

            const geojsonS1 = {
                'type': 'FeatureCollection',
                'features': []
            };

            for (let i = 0; i < data.results.length; i += 1) {

                let imgMeta = data.results[i];
                let feat = {
                    properties: {'id': imgMeta.sceneID},
                    type: 'Feature',
                    geometry: imgMeta.geometry
                };

                geojsonS1.features.push(feat);

                let className;
                if (sat.indexOf('sentinel1') === -1) {
                    className = 'item display-none';
                } else {
                    className = 'item';
                }

                $('.img-preview').append(
                    `<div sat="sentinel1" img-date="${imgMeta.date}" class="${className}" onmouseover="hoverS1('${imgMeta.sceneID}')" onmouseout="hoverS1('')">` +
                        `<img class="img-item img-responsive lazy lazyload" data-src="${imgMeta.browseURL}">` +
                        '<div class="result-overlay">' +
                            `<span><i class="fa fa-calendar-o"></i> ${imgMeta.date}</span>` +
                            `<span><i class="ms ms-satellite"></i> ${imgMeta.orbType.slice(0,4)} | ${imgMeta.refOrbit}</span>` +
                            `<span> Pol: ${imgMeta.polarisation} | SLC </span>` +
                            '<span>Link:</span>' +
                            `<a target="_blank" href="${imgMeta.pepsURL}"><img src="/img/peps.png"> </a>` +
                        '</div>' +
                    '</div>'
                );
            }
            map.getSource('sentinel-1').setData(geojsonS1);

            return callback(null, data.results.length);
        })
        .fail(() => {
            $('.disaster-images .api-status .peps-status').addClass('on');
            return callback(null, undefined);
        });
};

const getImages = () => {
    $('.disaster-images .api-status .status').removeClass('on');
    $('.disaster-images .spin-load').removeClass('display-none');
    $('.img-preview').empty();

    //Need to modulateGeometry
    const features = draw.getAll();
    if (features.features[0].geometry.type === 'Point') {
        let ll = mapboxgl.LngLat.convert(features.features[0].geometry.coordinates.slice(0,2)).wrap().toArray();
        features.features[0].geometry.coordinates = ll;
    } else {
        features.features[0].geometry.coordinates[0] = features.features[0].geometry.coordinates[0].map((e) => {
            return mapboxgl.LngLat.convert(e).wrap().toArray();
        });
    }

    const q = d3.queue()
        .defer(getL8S2Images, features.features[0])
        .defer(getS1Images, features.features[0]);

    q.awaitAll((error, images) => {
        $('.disaster-images .spin-load').addClass('display-none');
        if (!images[0] && !images[1]) {
            $('.img-preview').append('<div class="serv-error">' +
                '<span>Error: Cannot connect to APIs</span>' +
                '<div class="center-block"><button class="btn btn-default" onclick="getImages()">Retry</button></div>'
            );
        } else {
            sortListImage();
            if ($('.img-preview .item').length === 0) $('.img-preview').append('<span class="nodata-error">No image found</span>');
        }
    });
};

////////////////////////////////////////////////////////////////////////////////
// Load Events and See Images
const seeEQimages = (urlusgs) => {

    $('.map .spin').removeClass('display-none');

    draw.deleteAll();

    if (draw.getMode() !== 'static') draw.changeMode('static');

    $.get(`${disasterwatch_api_url}/toHTTPS?url=${urlusgs}`, (data) => {
        data = JSON.parse(data);
        draw.add(data.geometry);
        const features = draw.getAll();

        if (features.features[0].geometry.type === 'Point') {
            const round = turf.buffer(features.features[0], 100, 'kilometers');
            const bbox = turf.bbox(round);
            map.fitBounds(bbox, {padding: 20});
        }

        addType(document.getElementById('dropdown-menu').getElementsByClassName('earthquake')[0].parentElement);
        document.getElementById('disasterName').value = data.properties.title;
        document.getElementById('disasterPlace').value = data.properties.place;
        document.getElementById('disasterStartDate').value = moment(data.properties.time).utc().format('YYYY-MM-DD');
        document.getElementById('disasterEndDate').value = moment(data.properties.time).utc().format('YYYY-MM-DD');
        document.getElementById('disasterComments').value = data.properties.url;

        openleftBlock();
        getImages();

        $('.map .spin').addClass('display-none');
    })
        .fail(() => {
            $('.map .spin').addClass('display-none');
        });

    closePopup();
};

const seeEONETimages = (id) => {
    $('.map .spin').removeClass('display-none');

    draw.deleteAll();
    if (draw.getMode() !== 'static') draw.changeMode('static');

    var url = 'http://eonet.sci.gsfc.nasa.gov/api/v2.1/events/' + id;
    $.get(`${disasterwatch_api_url}/toHTTPS?url=${url}`, (data) => {
        data = JSON.parse(data);
        let feature = { 'type': 'LineString', 'coordinates': [] };
        if (data.geometries.length > 1) {
            for (let j = 0; j < data.geometries.length; j++) {
                feature.coordinates.push(data.geometries[j].coordinates);
            }
            feature = turf.buffer(feature, 100, 'meters');

        } else {
            feature = { 'type': 'Point', 'coordinates': data.geometries[0].coordinates};
        }

        draw.add(feature);
        const features = draw.getAll();
        let bbox;
        if (features.features[0].geometry.type === 'Point') {
            const round = turf.buffer(features.features[0], 100, 'kilometers');
            bbox = turf.bbox(round);
            map.fitBounds(bbox, {padding: 20});
        } else {
            bbox = turf.bbox(features.features[0].geometry);
            map.fitBounds(bbox, {padding: 20});
        }

        document.getElementById('disasterName').value = data.title;
        document.getElementById('disasterComments').value = data.description;
        document.getElementById('disasterStartDate').value = moment(data.geometries[0].date).format('YYYY-MM-DD');
        document.getElementById('disasterEndDate').value = moment(data.geometries[data.geometries.length - 1].date).format('YYYY-MM-DD');

        openleftBlock();
        getImages();
        $('.map .spin').addClass('display-none');
    })
        .fail(() => {
            $('.map .spin').addClass('display-none');
        });

    closePopup();
};

const seeVolcimages = (name) => {

    $('.map .spin').removeClass('display-none');

    const feat = map.getSource('volcanoes')._data.features.filter((e) => {
        return (e.properties.Name === name);
    })[0];

    draw.deleteAll();
    if (draw.getMode() !== 'static') draw.changeMode('static');

    draw.add(feat.geometry);

    const features = draw.getAll();
    const round = turf.buffer(features.features[0], 100, 'kilometers');
    const bbox = turf.bbox(round);

    map.fitBounds(bbox, {padding: 20});

    document.getElementById('disasterName').value = feat.properties.Name;

    openleftBlock();
    getImages();

    $('.map .spin').addClass('display-none');

    closePopup();
};

$('#s1-checkbox').change(() => {
    $('#s1-checkbox').parent().toggleClass('green');
});
