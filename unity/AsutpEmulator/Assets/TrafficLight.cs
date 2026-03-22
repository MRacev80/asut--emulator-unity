using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// TrafficLight — subscribes to PLCBridge.Tags["svetofor.state"]
/// and updates 3 circle Image colors: Red / Yellow / Green.
/// Also handles Reset and Enable buttons.
/// </summary>
public class TrafficLight : MonoBehaviour
{
    [Header("Traffic Light Circles — assign Image components")]
    public Image RedLight;
    public Image YellowLight;
    public Image GreenLight;

    [Header("Buttons")]
    public Button ResetButton;
    public Button EnableButton;
    public Text EnableButtonText;

    [Header("Colors")]
    public Color ColorOn  = Color.white;          // active state
    public Color ColorOff = new Color(1,1,1,0.15f); // dimmed

    // Reference to PLCBridge for sending write commands
    private PLCBridge _bridge;
    private bool _enableState = true;

    void Start()
    {
        _bridge = FindObjectOfType<PLCBridge>();

        // Set initial dimmed state
        SetAllOff();

        // Wire buttons
        if (ResetButton != null)
            ResetButton.onClick.AddListener(OnResetClick);

        if (EnableButton != null)
            EnableButton.onClick.AddListener(OnEnableClick);
    }

    void Update()
    {
        // Read svetofor.state from shared tag dictionary
        if (!PLCBridge.Tags.ContainsKey("svetofor.state")) return;

        string state = PLCBridge.Tags["svetofor.state"]?.ToString().Trim();

        switch (state)
        {
            case "Red":
                Set(true, false, false);
                break;
            case "Yellow":
                Set(false, true, false);
                break;
            case "Green":
                Set(false, false, true);
                break;
            default:
                SetAllOff();
                break;
        }
    }

    void Set(bool red, bool yellow, bool green)
    {
        if (RedLight   != null) RedLight.color   = red    ? Color.red    : ColorOff;
        if (YellowLight != null) YellowLight.color = yellow ? Color.yellow : ColorOff;
        if (GreenLight  != null) GreenLight.color  = green  ? Color.green  : ColorOff;
    }

    void SetAllOff()
    {
        if (RedLight   != null) RedLight.color   = ColorOff;
        if (YellowLight != null) YellowLight.color = ColorOff;
        if (GreenLight  != null) GreenLight.color  = ColorOff;
    }

    void OnResetClick()
    {
        if (_bridge != null)
            _bridge.WriteTag("plc.reset", "True");
        Debug.Log("TrafficLight: Reset sent");
    }

    void OnEnableClick()
    {
        _enableState = !_enableState;
        // Stop = threshold 0 (counter instantly resets, stays at 0)
        // Start = threshold 5 (normal operation)
        if (_bridge != null)
            _bridge.WriteTag("plc.threshold", _enableState ? "5" : "0");
        if (EnableButtonText != null)
            EnableButtonText.text = _enableState ? "Стоп" : "Пуск";
        Debug.Log($"TrafficLight: {(_enableState ? "Start" : "Stop")} — threshold={(_enableState ? 5 : 0)}");
    }
}
