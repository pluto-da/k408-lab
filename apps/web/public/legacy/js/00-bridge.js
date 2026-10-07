/* 学习事件出口：旧版模块通过 LAB_EMIT 广播 lab:event，由 React 端桥接器接收并上报。 */
(function () {
  window.LAB_EMIT = function (type, detail) {
    try {
      var d = { type: type, ts: Date.now() };
      for (var k in detail || {}) d[k] = detail[k];
      window.dispatchEvent(new CustomEvent("lab:event", { detail: d }));
    } catch (e) { /* 旧浏览器无 CustomEvent 时静默 */ }
  };
})();
