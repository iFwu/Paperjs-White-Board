import MQTT from "mqtt";
import paper from "paper";

var client;
var topic = "ysc";
var userId = Math.floor(Math.random() * 1000000);
var join = function(cb) {
  client = MQTT.connect(
    "wss://agora:agorabestvoip@b-8244de59-fcde-414f-b56c-3e55d2ce43ea-1.mq.us-west-1.amazonaws.com:61619"
  );
  client.on("connect", function() {
    console.log("mqtt: connect");
  });

  client.subscribe(topic, function(err) {
    if (err) {
      console.error(err);
    } else {
      console.log("mqtt: subscribe");
      cb && cb();
    }
  });

  client.on("message", function(topic, message) {
    console.log(topic, message.toString());
    onMessage(topic, message.toString());
  });
};
join();

var send = function(content) {
  console.log(topic, content);
  content.userId = userId;
  client.publish(topic, JSON.stringify(content), { retain: true });
};

var onMessage = function(topic, message) {
  var content = JSON.parse(message);
  if (content.userId === userId) return;
  if (content.action === "draw") {
    if (content.type === "stroke-rect") {
      drawStrokeRect(content);
    } else if (content.type === "circle") {
      drawCircle(content);
    }
  } else if (content.action === "move") {
    moveShape(content);
  }
};

var get = function(url, success) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.setRequestHeader("Content-type", "application/json; charset=utf-8");
  xhr.onload = function(e) {
    success && success(xhr.responseText);
  };
  xhr.send();
};
get("https://localhost:8001/getDraw?channel=ysc", function(data) {
  JSON.parse(data).map(function(d) {
    var content = JSON.parse(d);
    if (content.action === "draw") {
      if (content.type === "stroke-rect") {
        drawStrokeRect(content);
      } else if (content.type === "circle") {
        drawCircle(content);
      }
    } else if (content.action === "move") {
      moveShape(content);
    }
  });
});

/* ------------------------------ 初始化Canvas ------------------------------*/

var canvas = document.getElementById("c1");
paper.setup(canvas);
var view = paper.view;
var gShapes = [];

/* ------------------------------ 渲染接受的数据 ------------------------------*/
var drawStrokeRect = function(content) {
  var path = content.path;
  var from = new paper.Point(path.from.x, path.from.y);
  var to = new paper.Point(path.to.x, path.to.y);
  var shape = new paper.Shape.Rectangle(from, to);
  shape.strokeColor = "black";
  shape.strokeWidth = 3;
  gShapes[content.attr.seq] = shape;
};

var drawCircle = function(content) {
  var path = content.path;
  var shape = new paper.Path.Circle({
    center: new paper.Point(path.center.x, path.center.y),
    radius: path.radius,
    fillColor: "black"
  });
  gShapes[content.attr.seq] = shape;
};

var moveShape = function(content) {
  var shape = gShapes[content.attr.seq];
  shape.position = new paper.Point(content.path.to.x, content.path.to.y);
};

/* ------------------------------ 图形 ------------------------------*/

[...document.querySelectorAll('input[name="penType"]')].forEach(e => {
  e.addEventListener('click', function (e) {
    var value = e.target.value;
    console.log(value)
    if (value === "rect") {
      setRect();
    } else if (value === "circle") {
      setCircle();
    } else if (value === "select") {
      view.onMouseDown = null;
      view.onMouseDrag = null;
      view.onMouseUp = null;
      setDrag();
    } else {
      view.onMouseDown = null;
      view.onMouseDrag = null;
      view.onMouseUp = null;
    }
  })
})

var addDrag = function(shape, seq) {
  shape.onMouseDrag = function(e) {
    shape.position = e.point;
    send({
      action: "move",
      type: "circle",
      style: {},
      attr: {
        seq: seq
      },
      path: {
        to: {
          x: e.point.x,
          y: e.point.y
        }
      }
    });
  };
  shape.onMouseUp = function(e) {
    shape.position = e.point;
    send({
      action: "move",
      type: "circle",
      style: {},
      attr: {
        seq: seq
      },
      path: {
        to: {
          x: e.point.x,
          y: e.point.y
        }
      }
    });
    shape.onMouseUp = null;
    shape.onMouseDrag = null;
  };
};

var setDrag = function() {
  var keys = Object.keys(gShapes);
  keys.map(function(key) {
    console.log(gShapes[key], key);
    gShapes[key].onMouseDown = function(e) {
      addDrag(gShapes[key], key);
    };
  });
};

var setCircle = function() {
  var circleStartPoint, circle;
  view.onMouseDown = function(e) {
    circle = null;
    circleStartPoint = e.point;
  };
  view.onMouseDrag = function(e) {
    var centerX = (circleStartPoint.x + e.point.x) / 2;
    var centerY = (circleStartPoint.y + e.point.y) / 2;
    var radius = Math.abs(centerX - e.point.x);
    circle && circle.remove();
    // circle = new paper.Shape.Circle(new paper.Point(centerX, centerY), radius);
    circle = new paper.Path.Circle({
      center: new paper.Point(centerX, centerY),
      radius: radius,
      fillColor: "black"
    });
  };
  view.onMouseUp = function(e) {
    var centerX = (circleStartPoint.x + e.point.x) / 2;
    var centerY = (circleStartPoint.y + e.point.y) / 2;
    var radius = Math.abs(centerX - e.point.x);
    // circle = new paper.Shape.Circle(new paper.Point(centerX, centerY), radius);
    circle && circle.remove();
    var shape = new paper.Path.Circle({
      center: new paper.Point(centerX, centerY),
      radius: radius,
      fillColor: "black"
    });
    var seq = Math.floor(Math.random() * 1000000);
    gShapes[seq] = shape;
    send({
      action: "draw",
      type: "circle",
      style: {},
      attr: {
        seq: seq
      },
      path: {
        center: {
          x: centerX,
          y: centerY
        },
        radius: radius
      }
    });
  };
};

var setRect = function() {
  var rectStartPoint, rect;
  view.onMouseDown = function(e) {
    rect = null;
    rectStartPoint = e.point;
  };
  view.onMouseDrag = function(e) {
    rect && rect.remove();
    rect = new paper.Shape.Rectangle(rectStartPoint, e.point);
    rect.strokeColor = "black";
  };
  view.onMouseUp = function(e) {
    rect && rect.remove();
    var shape = new paper.Shape.Rectangle(rectStartPoint, e.point);
    shape.strokeColor = "black";
    var seq = Math.floor(Math.random() * 1000000);
    gShapes[seq] = shape;
    send({
      action: "draw",
      type: "stroke-rect",
      style: {},
      attr: {
        seq: seq
      },
      path: {
        from: {
          x: rectStartPoint.x,
          y: rectStartPoint.y
        },
        to: {
          x: e.point.x,
          y: e.point.y
        }
      }
    });
  };
};
setRect();
